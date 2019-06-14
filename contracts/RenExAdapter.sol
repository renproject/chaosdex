pragma solidity 0.5.8;

import "./RenEx.sol";
import "./RenExReserve.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract RenExAdapter is Ownable {
    RenEx public renex;

    event LogTransferIn(ERC20 src, uint256 amount);
    event LogTransferOut(ERC20 dst, uint256 amount);

    constructor(RenEx _renex) public {
        renex = _renex;
    }

    // solhint-disable-next-line no-empty-blocks
    function() external payable {
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
        uint256 transferredAmt = transferIn(_src, _dst, _amount, _hash, commit, _sig);
        emit LogTransferIn(_src, _amount);

        // Handle refunds if the refund block number has passed
        if (block.number > _refundBN) {
            if (RenExReserve(renex.reserve(_src, _dst)).isShifted(address(_src))) {
                RenExReserve(renex.reserve(_src, _dst)).shifters(address(_src)).shiftOut(_refundAddress, transferredAmt);
            }
            // FIXME: Also handle the refunds for non-shifted tokens
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
        RenExReserve reserve = RenExReserve(renex.reserve(_src, _dst));

        if (reserve.isShifted(address(_dst))) {
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
        if (reserve.isShifted(address(_dst))) {
            reserve.shifters(address(_dst)).shiftOut(_to, recvAmt);
        }
        emit LogTransferOut(_dst, recvAmt);
    }

    function transferIn(ERC20 _src, ERC20 _dst, uint256 _amount, bytes32 _hash, bytes32 _commitment, bytes memory _sig) internal returns (uint256) {
        RenExReserve reserve = RenExReserve(renex.reserve(_src, _dst));

        if (reserve.isShifted(address(_src))) {
            return reserve.shifters(address(_src)).shiftIn(address(this), _amount, _hash, _commitment, _sig);
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