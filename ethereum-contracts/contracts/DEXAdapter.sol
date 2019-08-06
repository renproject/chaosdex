pragma solidity ^0.5.8;

import "./DEX.sol";
import "./DEXReserve.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract DEXAdapter is Ownable {
    DEX public dex;

    event LogTransferIn(ERC20 src, uint256 amount);
    event LogTransferOut(ERC20 dst, uint256 amount);

    constructor(DEX _dex) public {
        dex = _dex;
    }

    // solhint-disable-next-line no-empty-blocks
    function() external payable {
    }

    // TODO: Fix "Stack too deep" error!
    uint256 transferredAmt;
    bytes32 pHash;

    function trade(
        // Payload
        /*uint256 _relayerFee,*/ ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes calldata _to,
        uint256 _refundBN, bytes calldata _refundAddress,
        // Required
        uint256 _amount, bytes32 _nHash, bytes calldata _sig
    ) external payable {
        pHash = hashPayload(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress);
        transferredAmt = _transferIn(_src, _dst, _amount, _nHash, pHash, _sig);
        emit LogTransferIn(_src, _amount);

        // Handle refunds if the refund block number has passed
        if (block.number >= _refundBN) {
            if (DEXReserve(dex.reserve(_src, _dst)).isShifted(address(_src))) {
                DEXReserve(dex.reserve(_src, _dst)).getShifter(address(_src)).shiftOut(_refundAddress, transferredAmt);
            }
            // FIXME: Also handle the refunds for non-shifted tokens
            return;
        }

        _doTrade(_src, _dst, _minDstAmt, _to, transferredAmt);
    }

    function hashPayload(
        /*uint256 _relayerFee,*/ ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes memory _to,
        uint256 _refundBN, bytes memory _refundAddress
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress));
    }

    function encodePayload(
        /*uint256 _relayerFee,*/ ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes memory _to,
        uint256 _refundBN, bytes memory _refundAddress
    ) public pure returns (bytes memory) {
        return abi.encode(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress);
    }

    function _doTrade(
        ERC20 _src, ERC20 _dst, uint256 _minDstAmt, bytes memory _to, uint256 _amount
    ) internal {
        uint256 recvAmt;
        address payable to;
        DEXReserve reserve = DEXReserve(dex.reserve(_src, _dst));

        if (reserve.isShifted(address(_dst))) {
            to = address(this);
        } else {
            to = _bytesToAddress(_to);
        }

        if (_src == dex.ethereum()) {
            recvAmt = dex.trade.value(msg.value)(to, _src, _dst, _amount);
        } else {
            _src.approve(address(dex), _amount);
            recvAmt = dex.trade(to, _src, _dst, _amount);
        }

        require(recvAmt >= _minDstAmt, "invalid receive amount");
        if (reserve.isShifted(address(_dst))) {
            reserve.getShifter(address(_dst)).shiftOut(_to, recvAmt);
        }
        emit LogTransferOut(_dst, recvAmt);
    }

    function _transferIn(
        /*uint256 _relayerFee,*/ ERC20 _src, ERC20 _dst, uint256 _amount,
        bytes32 _nHash, bytes32 _pHash, bytes memory _sig
    ) internal returns (uint256) {
        DEXReserve reserve = DEXReserve(dex.reserve(_src, _dst));

        if (reserve.isShifted(address(_src))) {
            return reserve.getShifter(address(_src)).shiftIn(_pHash, _amount, _nHash, _sig);
        } else if (_src == dex.ethereum()) {
            require(msg.value >= _amount, "insufficient eth amount");
            return msg.value;
        } else {
            require(_src.transferFrom(msg.sender, address(this), _amount), "source token transfer failed");
            return _amount;
        }
    }

    function _bytesToAddress(bytes memory _addr) internal pure returns (address payable) {
        address payable addr;
        /* solhint-disable-next-line */ /* solium-disable-next-line */
        assembly {
            addr := mload(add(_addr, 20))
        }
        return addr;
    }
}