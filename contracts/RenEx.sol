pragma solidity ^0.5.8;

import "./RenExReserve.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract RenEx {
    mapping (bytes32=>address payable) public reserves;
    ERC20 public ethereum = ERC20(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);

    event LogTrade(ERC20 _src, ERC20 _dst, uint256 _sendAmount, uint256 _recvAmount); 
    uint256 public feeinBIPs;

    constructor(uint256 _feeinBIPs) public {
        feeinBIPs = _feeinBIPs;
    }

    function trade(address payable _to, ERC20 _src, ERC20 _dst, uint256 _sendAmount) public payable returns (uint256) {
        address payable reserve = reserve(_src, _dst);
        require(reserve != address(0x0), "unsupported token pair");
        uint256 recvAmount = calculateReceiveAmount(_src, _dst, _sendAmount);

        if (_src != ethereum) {
            require(_src.transferFrom(msg.sender, reserve, _sendAmount), "source token transfer failed");
        } else {
            require(msg.value >= _sendAmount, "invalid msg.value");
            reserve.transfer(msg.value);
        }

        if (_dst != ethereum) {
            require(_dst.transferFrom(reserve, _to, recvAmount), "destination token transfer failed");
        } else {
            RenExReserve(reserve).transfer(_to, recvAmount);
        }

        emit LogTrade(_src, _dst, _sendAmount, recvAmount);
        return recvAmount;
    }

    function registerReserve(ERC20 _a, ERC20 _b, address payable _reserve) public {
        reserves[tokenPairID(_a, _b)] = _reserve;
    }

    function calculateReceiveAmount(ERC20 _src, ERC20 _dst, uint256 _sendAmount) public view returns (uint256) {
        address reserve = reserve(_src, _dst);
        uint256 srcAmount = _src == ethereum ? reserve.balance : _src.balanceOf(reserve);
        uint256 dstAmount = _dst == ethereum ? reserve.balance : _dst.balanceOf(reserve);
        uint256 rcvAmount = dstAmount - ((srcAmount*dstAmount)/(srcAmount+_sendAmount));
        return (rcvAmount * (10000 - feeinBIPs))/10000;
    }

    function reserve(ERC20 _a, ERC20 _b) public view returns (address payable) {
        return reserves[tokenPairID(_a, _b)];
    }
    
    function tokenPairID(ERC20 _a, ERC20 _b) public pure returns (bytes32) {
        return uint160(address(_a)) < uint160(address(_b)) ? 
            keccak256(abi.encodePacked(_a, _b)) : keccak256(abi.encodePacked(_b, _a));
    }
}