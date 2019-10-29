pragma solidity ^0.5.8;

import "darknode-sol/contracts/Shifter/Shifter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title DEXReserve
/// @notice The DEX Reserve holds the liquidity for a single token pair for the
/// DEX. Anyone can add liquidity, receiving in return a token representing
/// a share in the funds held by the reserve.
contract DEXReserve is ERC20, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    uint256 FeeInBIPS;
    uint256 PendingFeeInBIPS;
    uint256 FeeChangeBlock;

    ERC20 public BaseToken;
    ERC20 public Token;
    event LogAddLiquidity(address _liquidityProvider, uint256 _tokenAmount, uint256 _baseTokenAmount);
    event LogDebug(uint256 _rcvAmount);
    event LogFeesChanged(uint256 _previousFeeInBIPS, uint256 _newFeeInBIPS);

    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public {
        BaseToken = _baseToken;
        Token = _token;
        FeeInBIPS = _feeInBIPS;
        PendingFeeInBIPS = _feeInBIPS;
    }

    /// @notice Allow anyone to recover funds accidentally sent to the contract.
    /// To withdraw ETH, the token should be set to `0x0`.
    function recoverTokens(address _token) external onlyOwner {
        require(ERC20(_token) != BaseToken && ERC20(_token) != Token, "not allowed to recover reserve tokens");
        ERC20(_token).transfer(msg.sender, ERC20(_token).balanceOf(address(this)));
    }

    /// @notice Allow the reserve manager too update the contract fees.
    /// There is a 10 block delay to reduce the chance of front-running trades.
    function updateFee(uint256 _pendingFeeInBIPS) external onlyOwner {
        if (_pendingFeeInBIPS == PendingFeeInBIPS) {
            require(block.number >= FeeChangeBlock);
            emit LogFeesChanged(FeeInBIPS, PendingFeeInBIPS);
            FeeInBIPS = PendingFeeInBIPS;
        } else {
            FeeChangeBlock = FeeChangeBlock + 100;
            PendingFeeInBIPS = _pendingFeeInBIPS;
        }
    }

    function buy(address _to, address _from, uint256 _baseTokenAmount) external returns (uint256)  {
        require(totalSupply() != 0, "reserve has no funds");
        uint256 rcvAmount = calculateBuyRcvAmt(_baseTokenAmount);
        BaseToken.safeTransferFrom(_from, address(this), _baseTokenAmount);
        Token.safeTransfer(_to, rcvAmount);
        return rcvAmount;
    }

    function sell(address _to, address _from, uint256 _tokenAmount) external returns (uint256) {
        require(totalSupply() != 0, "reserve has no funds");
        uint256 rcvAmount = calculateSellRcvAmt(_tokenAmount);
        Token.safeTransferFrom(_from, address(this), _tokenAmount);
        BaseToken.safeTransfer(_to, rcvAmount);
        return rcvAmount;
    }

    function calculateBuyRcvAmt(uint256 _sendAmt) public view returns (uint256) {
        uint256 baseReserve = BaseToken.balanceOf(address(this));
        uint256 tokenReserve = Token.balanceOf(address(this));
        uint256 finalQuoteTokenAmount = (baseReserve.mul(tokenReserve)).div(baseReserve.add(_sendAmt));
        uint256 rcvAmt = tokenReserve.sub(finalQuoteTokenAmount);
        return _removeFees(rcvAmt);
    }

    function calculateSellRcvAmt(uint256 _sendAmt) public view returns (uint256) {
        uint256 baseReserve = BaseToken.balanceOf(address(this));
        uint256 tokenReserve = Token.balanceOf(address(this));
        uint256 finalBaseTokenAmount = (baseReserve.mul(tokenReserve)).div(tokenReserve.add(_sendAmt));
        uint256 rcvAmt = baseReserve.sub(finalBaseTokenAmount);
        return _removeFees(rcvAmt);
    }

    function removeLiquidity(uint256 _liquidity) external returns (uint256, uint256) {
        require(balanceOf(msg.sender) >= _liquidity, "insufficient balance");
        uint256 baseTokenAmount = calculateBaseTokenValue(_liquidity);
        uint256 quoteTokenAmount = calculateQuoteTokenValue(_liquidity);
        _burn(msg.sender, _liquidity);
        BaseToken.safeTransfer(msg.sender, baseTokenAmount);
        Token.safeTransfer(msg.sender, quoteTokenAmount);
        return (baseTokenAmount, quoteTokenAmount);
    }

    function addLiquidity(
        address _liquidityProvider, uint256 _maxBaseToken, uint256 _tokenAmount, uint256 _deadline
        ) external returns (uint256) {
        require(block.number <= _deadline, "addLiquidity request expired");
        if (totalSupply() > 0) {
            require(_tokenAmount > 0, "token amount is less than allowed min amount");
            uint256 baseAmount = expectedBaseTokenAmount(_tokenAmount);
            require(baseAmount <= _maxBaseToken, "calculated base amount exceeds the maximum amount set");
            BaseToken.safeTransferFrom(_liquidityProvider, address(this), baseAmount);
            emit LogAddLiquidity(_liquidityProvider, _tokenAmount, baseAmount);
        } else {
            BaseToken.safeTransferFrom(_liquidityProvider, address(this), _maxBaseToken);
            emit LogAddLiquidity(_liquidityProvider, _tokenAmount, _maxBaseToken);
        }
        Token.safeTransferFrom(msg.sender, address(this), _tokenAmount);
        _mint(_liquidityProvider, _tokenAmount*2);
        return _tokenAmount*2;
    }

    function calculateBaseTokenValue(uint256 _liquidity) public view returns (uint256) {
        require(totalSupply() != 0, "division by zero");
        uint256 baseReserve = BaseToken.balanceOf(address(this));
        return (_liquidity * baseReserve)/totalSupply();
    }

    function calculateQuoteTokenValue(uint256 _liquidity) public view returns (uint256) {
        require(totalSupply() != 0,  "division by zero");
        uint256 tokenReserve = Token.balanceOf(address(this));
        return (_liquidity * tokenReserve)/totalSupply();
    }

    function expectedBaseTokenAmount(uint256 _quoteTokenAmount) public view returns (uint256) {
        uint256 baseReserve = BaseToken.balanceOf(address(this));
        uint256 tokenReserve = Token.balanceOf(address(this));
        return (_quoteTokenAmount * baseReserve)/tokenReserve;
    }

    function _removeFees(uint256 _amount) internal view returns (uint256) {
        return (_amount * (10000 - FeeInBIPS))/10000;
    }
}

/* solhint-disable-next-line */ /* solium-disable-next-line */
contract BTC_DAI_Reserve is DEXReserve {
    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public DEXReserve(_baseToken, _token, _feeInBIPS) {
    }
}

/* solhint-disable-next-line */ /* solium-disable-next-line */
contract ZEC_DAI_Reserve is DEXReserve {
    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public DEXReserve(_baseToken, _token, _feeInBIPS) {
    }
}