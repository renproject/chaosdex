pragma solidity ^0.5.0;

import "./DEXReserve.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract DEX {
    mapping (address=>DEXReserve) public reserves;
    address public BaseToken;
    address public ethereum = address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    uint256 public FeeInBips;

    event LogTrade(address _src, address _dst, uint256 _sendAmount, uint256 _recvAmount);

    constructor(address _baseToken, uint256 _feeInBips) public {
        BaseToken = _baseToken;
        FeeInBips = _feeInBips;
    }

    function registerReserve(address _erc20, DEXReserve _reserve) external {
        require(reserves[_erc20] == DEXReserve(0x0), "token reserve already registered");
        reserves[_erc20] = _reserve;
    }

    function trade(address payable _to, address _src, address _dst, uint256 _sendAmount) public payable returns (uint256) {
        uint256 recvAmount;
        if (_src == BaseToken) {
            require(reserves[_dst] != DEXReserve(0x0), "unsupported token");
            recvAmount = reserves[_dst].buy(_to, msg.sender, _sendAmount);
        } else if (_dst == BaseToken) {
            require(reserves[_src] != DEXReserve(0x0), "unsupported token");
            recvAmount = reserves[_src].sell(_to, msg.sender, _sendAmount);
        } else {
            require(reserves[_src] != DEXReserve(0x0) && reserves[_dst] != DEXReserve(0x0), "unsupported token");
            uint256 intermediteAmount = reserves[_src].sell(address(this), msg.sender, _sendAmount);
            ERC20(BaseToken).approve(address(reserves[_dst]), intermediteAmount);
            recvAmount = reserves[_dst].buy(_to, address(this), intermediteAmount);
        }
        emit LogTrade(_src, _dst, _sendAmount, recvAmount);
        return recvAmount;
    }

    function calculateReceiveAmount(address _src, address _dst, uint256 _sendAmount) public view returns (uint256) {
        if (_src == BaseToken) {
            return reserves[_dst].calculateBuyRcvAmt(_sendAmount);
        }
        if (_dst == BaseToken) {
            return reserves[_src].calculateSellRcvAmt(_sendAmount);
        }
        return reserves[_dst].calculateBuyRcvAmt(reserves[_src].calculateSellRcvAmt(_sendAmount));
    }
}