pragma solidity ^0.5.8;

import "darknode-sol/contracts/Shifter/Shifter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract DEXReserve is ERC20 {
    uint256 FeeInBIPS;
    ERC20 public BaseToken;
    ERC20 public Token;
    event LogAddLiquidity(address _liquidityProvider, uint256 _tokenAmount, uint256 _baseTokenAmount);
    event LogDebug(uint256 _rcvAmount);

    constructor (ERC20 _baseToken, ERC20 _token, uint256 _feeInBIPS) public {
        BaseToken = _baseToken;
        Token = _token;
        FeeInBIPS = _feeInBIPS;
    }

    function buy(address _to, address _from, uint256 _baseTokenAmount) external returns (uint256)  {
        BaseToken.transferFrom(_from, address(this), _baseTokenAmount);
        uint256 rcvAmount = calculateBuyRcvAmt(_baseTokenAmount);
        require(rcvAmount < Token.balanceOf(address(this)), "insufficient balance");
        require(Token.transfer(_to, rcvAmount), "failed to transfer quote token");
        return rcvAmount;
    }

    function sell(address _to, address _from, uint256 _tokenAmount) external returns (uint256) {
        Token.transferFrom(_from, address(this), _tokenAmount);
        uint256 rcvAmount = calculateSellRcvAmt(_tokenAmount);
        require(BaseToken.transfer(_to, rcvAmount), "failed to transfer base token");
        return rcvAmount;
    }

    function calculateBuyRcvAmt(uint256 _sendAmt) public view returns (uint256) {
        uint256 daiReserve = BaseToken.balanceOf(address(this));
        uint256 tokenReserve = Token.balanceOf(address(this));
        uint256 finalQuoteTokenAmount = (daiReserve.mul(tokenReserve)).div(daiReserve.add(_sendAmt));
        uint256 rcvAmt = tokenReserve.sub(finalQuoteTokenAmount);
        return _removeFees(rcvAmt);
    }

    function calculateSellRcvAmt(uint256 _sendAmt) public view returns (uint256) {
        uint256 daiReserve = BaseToken.balanceOf(address(this));
        uint256 tokenReserve = Token.balanceOf(address(this));
        uint256 finalBaseTokenAmount = (daiReserve.mul(tokenReserve)).div(tokenReserve.add(_sendAmt));
        uint256 rcvAmt = daiReserve.sub(finalBaseTokenAmount);
        return _removeFees(rcvAmt);
    }

    function removeLiquidity(uint256 _liquidity) external returns (uint256, uint256) {
        require(balanceOf(msg.sender) >= _liquidity, "insufficient balance");
        uint256 baseTokenAmount = calculateBaseTokenValue(_liquidity);
        uint256 quoteTokenAmount = calculateQuoteTokenValue(_liquidity);
        _burn(msg.sender, _liquidity);
        BaseToken.transfer(msg.sender, baseTokenAmount);
        Token.transfer(msg.sender, quoteTokenAmount);
        return (baseTokenAmount, quoteTokenAmount);
    }

    function addLiquidity(
        address _liquidiyProvider, uint256 _maxBaseToken, uint256 _tokenAmount, uint256 _deadline
        ) external returns (uint256) {
        require(_deadline > block.number, "addLiquidity request expired");
        Token.transferFrom(msg.sender, address(this), _tokenAmount);
        if (totalSupply() > 0) {
            require(_tokenAmount > 0, "token amount is less than allowed min amount");
            uint256 daiAmount = expectedBaseTokenAmount(_tokenAmount);
            require(daiAmount < _maxBaseToken && BaseToken.transferFrom(_liquidiyProvider, address(this), daiAmount), "failed to transfer base token");
            emit LogAddLiquidity(_liquidiyProvider, _tokenAmount, daiAmount);
        } else {
            require(BaseToken.transferFrom(_liquidiyProvider, address(this), _maxBaseToken), "failed to transfer base token");
            emit LogAddLiquidity(_liquidiyProvider, _tokenAmount, _maxBaseToken);
        }
        _mint(_liquidiyProvider, _tokenAmount*2);
        return _tokenAmount*2;
    }

    function calculateBaseTokenValue(uint256 _liquidity) public view returns (uint256) {
        require(totalSupply() != 0, "Division by Zero");
        uint256 daiReserve = BaseToken.balanceOf(address(this));
        return (_liquidity * daiReserve)/totalSupply();
    }

    function calculateQuoteTokenValue(uint256 _liquidity) public view returns (uint256) {
        require(totalSupply() != 0, "Division by Zero");
        uint256 tokenReserve = Token.balanceOf(address(this));
        return (_liquidity * tokenReserve)/totalSupply();
    }

    function expectedBaseTokenAmount(uint256 _quoteTokenAmount) public view returns (uint256) {
        uint256 daiReserve = BaseToken.balanceOf(address(this));
        uint256 tokenReserve = Token.balanceOf(address(this));
        return (_quoteTokenAmount * daiReserve)/tokenReserve;
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