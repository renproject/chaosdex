pragma solidity 0.5.8;

import "./RenEx.sol";
import "darknode-sol/contracts/RenShift/RenShift.sol";
import "darknode-sol/contracts/RenShift/ERC20Shifted.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract RenExAdapter is Ownable {
    RenEx public renex;
    RenShift public renshift;

    event LogTransferIn(ERC20 src, uint256 amount);
    event LogTransferOut(ERC20 dst, uint256 amount);

    constructor(RenEx _renex, RenShift _renshift) public {
        renex = _renex;
        renshift = _renshift;
    }

    // solhint-disable-next-line no-empty-blocks
    function() external payable {
    }

    function updateRenShift(RenShift _renshift) external onlyOwner {
        renshift = _renshift;
    }

    function updateRenEx(RenEx _renex) external onlyOwner {
        renex = _renex;
    }

    function trade(
        ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes calldata _to,
        uint256 _refundBN, bytes calldata _refundAddress,
        uint256 _amount, bytes32 _hash, bytes calldata _sig
    ) external payable { 
        bytes32 commit = commitment(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress);
        uint256 transferredAmt = transferIn(_src, _amount, _hash, commit, _sig);
        emit LogTransferIn(_src, _amount);
        if (block.number > _refundBN && renshift.isShiftedToken(address(_src))) {
            renshift.shiftOut(ERC20Shifted(address(_src)), _refundAddress, transferredAmt);
            return;
        }
        doTrade(_src, _dst, _minDstAmt, _to, transferredAmt);
    }

    function commitment(
        ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes memory _to,
        uint256 _refundBN, bytes memory _refundAddress
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress));
    }

    function doTrade(
        ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes memory _to, uint256 _amount
    ) internal { 
        uint256 recvAmt;
        address payable to;

        if (renshift.isShiftedToken(address(_dst))) {
            to = address(this);
        } else {
            to = bytesToAddress(_to);
        }

        if (_src == renex.ethereum()) {
            recvAmt = renex.trade.value(msg.value)(to, _src, _dst, _amount);
        } else {    
            _src.approve(address(renex), _amount);
            recvAmt = renex.trade(to, _src, _dst, _amount);
        }

        require(recvAmt > _minDstAmt, "invalid receive amount");
        if (renshift.isShiftedToken(address(_dst))) {
            renshift.shiftOut(ERC20Shifted(address(_dst)), _to, recvAmt);
        }
        emit LogTransferOut(_dst, recvAmt);
    }

    function transferIn(ERC20 _src, uint256 _amount, bytes32 _hash, bytes32 _commitment, bytes memory _sig) internal returns (uint256) {        
        if (renshift.isShiftedToken(address(_src))) {
            return renshift.shiftIn(ERC20Shifted(address(_src)), address(this), _amount, _hash, _commitment, _sig);
        } else if (_src == renex.ethereum()) {
            require(msg.value >= _amount, "insufficient eth amount");
            return msg.value;
        } else {
            require(_src.transferFrom(msg.sender, address(this), _amount), "source token transfer failed");
            return _amount;
        }
    }

    function bytesToAddress(bytes memory _addr) internal pure returns (address payable) {
        address payable addr;  
        /* solhint-disable-next-line */ /* solium-disable-next-line */
        assembly {
            addr := mload(add(_addr, 20))
        } 
        return addr;
    }
}