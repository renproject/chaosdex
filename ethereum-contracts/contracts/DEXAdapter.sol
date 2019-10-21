pragma solidity ^0.5.8;

import "./DEX.sol";
import "./DEXReserve.sol";
import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";
import "darknode-sol/contracts/Shifter/IShifter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract DEXAdapter {
    DEX public dex;
    ShifterRegistry public shifterRegistry;

    event LogTransferIn(address src, uint256 amount);
    event LogTransferOut(address dst, uint256 amount);

    constructor(DEX _dex, ShifterRegistry _shifterRegistry) public {
        shifterRegistry = _shifterRegistry;
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
        /*uint256 _relayerFee,*/ address _src, address _dst, uint256 _minDstAmt, bytes calldata _to,
        uint256 _refundBN, bytes calldata _refundAddress,
        // Required
        uint256 _amount, bytes32 _nHash, bytes calldata _sig
    ) external payable {
        pHash = hashPayload(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress);
        // Handle refunds if the refund block number has passed
        if (block.number >= _refundBN) {
            IShifter shifter = shifterRegistry.getShifterByToken(address(_src));
            if (shifter != IShifter(0x0)) {
                transferredAmt = shifter.shiftIn(pHash, _amount, _nHash, _sig);
                shifter.shiftOut(_refundAddress, transferredAmt);
            }
            return;
        }

        transferredAmt = _transferIn(_src, _amount, _nHash, pHash, _sig);
        emit LogTransferIn(_src, transferredAmt);
        _doTrade(_src, _dst, _minDstAmt, _to, transferredAmt);
    }

    function hashPayload(
        /*uint256 _relayerFee,*/ address _src, address _dst, uint256 _minDstAmt, bytes memory _to,
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
        address _src, address _dst, uint256 _minDstAmt, bytes memory _to, uint256 _amount
    ) internal {
        uint256 recvAmt;
        address payable to;
        IShifter shifter = shifterRegistry.getShifterByToken(address(_dst));

        if (shifter != IShifter(0x0)) {
            to = address(this);
        } else {
            to = _bytesToAddress(_to);
        }

        if (_src == dex.ethereum()) {
            recvAmt = dex.trade.value(msg.value)(to, _src, _dst, _amount);
        } else {
            if (_src == dex.BaseToken()) {
                ERC20(_src).approve(address(dex.reserves(_dst)), _amount);
            } else {
                ERC20(_src).approve(address(dex.reserves(_src)), _amount);
            }
            recvAmt = dex.trade(to, _src, _dst, _amount);
        }

        require(recvAmt > 0 && recvAmt >= _minDstAmt, "invalid receive amount");
        if (shifter != IShifter(0x0)) {
            shifter.shiftOut(_to, recvAmt);
        }
        emit LogTransferOut(_dst, recvAmt);
    }

    function _transferIn(
        /*uint256 _relayerFee,*/ address _src, uint256 _amount,
        bytes32 _nHash, bytes32 _pHash, bytes memory _sig
    ) internal returns (uint256) {
        IShifter shifter = shifterRegistry.getShifterByToken(address(_src));
        if (shifter != IShifter(0x0)) {
            return shifter.shiftIn(_pHash, _amount, _nHash, _sig);
        } else if (_src == dex.ethereum()) {
            require(msg.value >= _amount, "insufficient eth amount");
            return msg.value;
        } else {
            require(ERC20(_src).transferFrom(msg.sender, address(this), _amount), "source token transfer failed");
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

    function calculateReceiveAmount(address _src, address _dst, uint256 _sendAmount) public view returns (uint256) {
        return dex.calculateReceiveAmount(_src, _dst, _sendAmount);
    }
}