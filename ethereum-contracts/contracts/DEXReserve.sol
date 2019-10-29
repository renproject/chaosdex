pragma solidity ^0.5.8;

import "darknode-sol/contracts/Shifter/Shifter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/// @title DEXReserve
/// @notice The DEX Reserve holds the liquidity for a single token pair for the
/// DEX. Anyone can add liquidity, receiving in return a token representing
/// a share in the funds held by the reserve.
contract DEXReserve is ERC20, ERC20Detailed, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    uint256 public feeInBIPS;
    uint256 public pendingFeeInBIPS;
    uint256 public feeChangeBlock;

    ERC20 public baseToken;
    ERC20 public token;
    event LogAddLiquidity(address _liquidityProvider, uint256 _tokenAmount, uint256 _baseTokenAmount);
    event LogDebug(uint256 _rcvAmount);
    event LogFeesChanged(uint256 _previousFeeInBIPS, uint256 _newFeeInBIPS);

    constructor (string memory _name, string memory _symbol, uint8 _decimals, ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public ERC20Detailed(_name, _symbol, _decimals) {
        baseToken = _baseToken;
        token = _token;
        feeInBIPS = _feeInBIPS;
        pendingFeeInBIPS = _feeInBIPS;
    }

    /// @notice Allow anyone to recover funds accidentally sent to the contract.
    function recoverTokens(address _token) external onlyOwner {
        require(ERC20(_token) != baseToken && ERC20(_token) != token, "not allowed to recover reserve tokens");
        ERC20(_token).transfer(msg.sender, ERC20(_token).balanceOf(address(this)));
    }

    /// @notice Allow the reserve manager too update the contract fees.
    /// There is a 10 block delay to reduce the chance of front-running trades.
    function updateFee(uint256 _pendingFeeInBIPS) external onlyOwner {
        if (_pendingFeeInBIPS == pendingFeeInBIPS) {
            require(block.number >= feeChangeBlock, "must wait 100 blocks before updating the fee");
            emit LogFeesChanged(feeInBIPS, pendingFeeInBIPS);
            feeInBIPS = pendingFeeInBIPS;
        } else {
            // @dev 500 was chosen as an arbitrary limit - the fee should be
            // well below that.
            require(_pendingFeeInBIPS < 500, "fee must not exceed hard-coded limit");
            feeChangeBlock = block.number + 100;
            pendingFeeInBIPS = _pendingFeeInBIPS;
        }
    }

    function buy(address _to, address _from, uint256 _baseTokenAmount) external returns (uint256)  {
        require(totalSupply() != 0, "reserve has no funds");
        uint256 rcvAmount = calculateBuyRcvAmt(_baseTokenAmount);
        baseToken.safeTransferFrom(_from, address(this), _baseTokenAmount);
        token.safeTransfer(_to, rcvAmount);
        return rcvAmount;
    }

    function sell(address _to, address _from, uint256 _tokenAmount) external returns (uint256) {
        require(totalSupply() != 0, "reserve has no funds");
        uint256 rcvAmount = calculateSellRcvAmt(_tokenAmount);
        token.safeTransferFrom(_from, address(this), _tokenAmount);
        baseToken.safeTransfer(_to, rcvAmount);
        return rcvAmount;
    }

    function calculateBuyRcvAmt(uint256 _sendAmt) public view returns (uint256) {
        uint256 baseReserve = baseToken.balanceOf(address(this));
        uint256 tokenReserve = token.balanceOf(address(this));
        uint256 finalQuoteTokenAmount = (baseReserve.mul(tokenReserve)).div(baseReserve.add(_sendAmt));
        uint256 rcvAmt = tokenReserve.sub(finalQuoteTokenAmount);
        return _removeFees(rcvAmt);
    }

    function calculateSellRcvAmt(uint256 _sendAmt) public view returns (uint256) {
        uint256 baseReserve = baseToken.balanceOf(address(this));
        uint256 tokenReserve = token.balanceOf(address(this));
        uint256 finalBaseTokenAmount = (baseReserve.mul(tokenReserve)).div(tokenReserve.add(_sendAmt));
        uint256 rcvAmt = baseReserve.sub(finalBaseTokenAmount);
        return _removeFees(rcvAmt);
    }

    function removeLiquidity(uint256 _liquidity) external returns (uint256, uint256) {
        require(balanceOf(msg.sender) >= _liquidity, "insufficient liquidity");
        uint256 baseTokenAmount = calculateBaseTokenValue(_liquidity);
        uint256 quoteTokenAmount = calculateQuoteTokenValue(_liquidity);
        _burn(msg.sender, _liquidity);
        baseToken.safeTransfer(msg.sender, baseTokenAmount);
        token.safeTransfer(msg.sender, quoteTokenAmount);
        return (baseTokenAmount, quoteTokenAmount);
    }

    function addLiquidity(
        address _liquidityProvider, uint256 _maxBaseToken, uint256 _tokenAmount, uint256 _deadline
        ) external returns (uint256) {
        require(block.number <= _deadline, "addLiquidity request expired");
        uint256 liquidity = calculateExpectedLiquidity(_tokenAmount); 
        if (totalSupply() > 0) {
            require(_tokenAmount > 0, "token amount is less than allowed min amount");
            uint256 baseAmount = expectedBaseTokenAmount(_tokenAmount);
            require(baseAmount <= _maxBaseToken, "calculated base amount exceeds the maximum amount set");
            baseToken.safeTransferFrom(_liquidityProvider, address(this), baseAmount);
            emit LogAddLiquidity(_liquidityProvider, _tokenAmount, baseAmount);
        } else {
            baseToken.safeTransferFrom(_liquidityProvider, address(this), _maxBaseToken);
            emit LogAddLiquidity(_liquidityProvider, _tokenAmount, _maxBaseToken);
        }
        token.safeTransferFrom(msg.sender, address(this), _tokenAmount);
        _mint(_liquidityProvider, liquidity);
        return liquidity;
    }

    function calculateBaseTokenValue(uint256 _liquidity) public view returns (uint256) {
        require(totalSupply() != 0, "division by zero");
        uint256 baseReserve = baseToken.balanceOf(address(this));
        return (_liquidity * baseReserve)/totalSupply();
    }

    function calculateQuoteTokenValue(uint256 _liquidity) public view returns (uint256) {
        require(totalSupply() != 0,  "division by zero");
        uint256 tokenReserve = token.balanceOf(address(this));
        return (_liquidity * tokenReserve)/totalSupply();
    }

    function expectedBaseTokenAmount(uint256 _quoteTokenAmount) public view returns (uint256) {
        uint256 baseReserve = baseToken.balanceOf(address(this));
        uint256 tokenReserve = token.balanceOf(address(this));
        return (_quoteTokenAmount * baseReserve)/tokenReserve;
    }

    function calculateExpectedLiquidity(uint256 _tokenAmount) public view returns (uint256) {
        if (totalSupply() == 0) {
            return _tokenAmount*2;
        }
        return ((totalSupply()*_tokenAmount)/token.balanceOf(address(this)));
    }

    function _removeFees(uint256 _amount) internal view returns (uint256) {
        return (_amount * (10000 - feeInBIPS))/10000;
    }
}

/* solhint-disable-next-line */ /* solium-disable-next-line */
contract BTC_DAI_Reserve is DEXReserve {
    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public DEXReserve("Bitcoin Liquidity Token", "BTCLT", 8, _baseToken, _token, _feeInBIPS) {
    }
}

/* solhint-disable-next-line */ /* solium-disable-next-line */
contract ZEC_DAI_Reserve is DEXReserve {
    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public DEXReserve("ZCash Liquidity Token", "ZECLT", 8, _baseToken, _token, _feeInBIPS) {
    }
}

/* solhint-disable-next-line */ /* solium-disable-next-line */
contract BCH_DAI_Reserve is DEXReserve {
    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public DEXReserve("BitcoinCash Liquidity Token", "BCHLT", 8, _baseToken, _token, _feeInBIPS) {
    }
}