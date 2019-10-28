pragma solidity ^0.5.8;

import "./DEX.sol";
import "./DEXReserve.sol";
import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";
import "darknode-sol/contracts/Shifter/IShifter.sol";
import "darknode-sol/contracts/libraries/CompatibleERC20Functions.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract DEXAdapter {
    using CompatibleERC20Functions for ERC20;

    DEX public dex;
    ShifterRegistry public shifterRegistry;

    event LogTransferIn(address src, uint256 amount);
    event LogTransferOut(address dst, uint256 amount);

    constructor(DEX _dex, ShifterRegistry _shifterRegistry) public {
        shifterRegistry = _shifterRegistry;
        dex = _dex;
    }

    /// @notice Allow anyone to recover funds accidentally sent to the contract.
    function recoverTokens(address _token) external {
        ERC20(_token).transfer(msg.sender, ERC20(_token).balanceOf(address(this)));
    }

    // TODO: Fix "Stack too deep" error!
    uint256 transferredAmt;

    function trade(
        // Payload
        /*uint256 _relayerFee,*/ address _src, address _dst, uint256 _minDstAmt, bytes calldata _to,
        uint256 _refundBN, bytes calldata _refundAddress,
        // Required
        uint256 _amount, bytes32 _nHash, bytes calldata _sig
    ) external {
        transferredAmt;
        bytes32 pHash = hashTradePayload(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress);
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

    function hashTradePayload(
        /*uint256 _relayerFee,*/ address _src, address _dst, uint256 _minDstAmt, bytes memory _to,
        uint256 _refundBN, bytes memory _refundAddress
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_src, _dst, _minDstAmt, _to, _refundBN, _refundAddress));
    }

    function hashLiquidityPayload(
        address _liquidityProvider,  uint256 _maxBaseToken, address _token,
        uint256 _refundBN, bytes memory _refundAddress
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_liquidityProvider, _maxBaseToken, _token, _refundBN, _refundAddress));
    }

    function addLiquidity(
        address _liquidityProvider,  uint256 _maxBaseToken, address _token, uint256 _deadline, bytes calldata _refundAddress,
        uint256 _amount, bytes32 _nHash, bytes calldata _sig
        ) external returns (uint256) {
            DEXReserve reserve = dex.reserves(_token);
            require(reserve != DEXReserve(0x0), "unsupported token");
            bytes32 lpHash = hashLiquidityPayload(_liquidityProvider, _maxBaseToken, _token, _deadline, _refundAddress);
            if (block.number > _deadline) {
                uint256 shiftedAmount = shifterRegistry.getShifterByToken(_token).shiftIn(lpHash, _amount, _nHash, _sig);
                shifterRegistry.getShifterByToken(_token).shiftOut(_refundAddress, shiftedAmount);
                return 0;
            }
            require(ERC20(dex.BaseToken()).allowance(_liquidityProvider, address(reserve)) >= _maxBaseToken,
                "insufficient base token allowance");
            uint256 transferredAmount = _transferIn(_token, _amount, _nHash, lpHash, _sig);
            ERC20(_token).approve(address(reserve), transferredAmount);
            return reserve.addLiquidity(_liquidityProvider, _maxBaseToken, transferredAmount, _deadline);
    }

    function removeLiquidity(address _token, uint256 _liquidity, bytes calldata _tokenAddress) external {
        DEXReserve reserve = dex.reserves(_token);
        require(reserve != DEXReserve(0x0), "unsupported token");
        ERC20(reserve).safeTransferFrom(msg.sender, address(this), _liquidity);
        (uint256 baseTokenAmount, uint256 quoteTokenAmount) = reserve.removeLiquidity(_liquidity);
        reserve.BaseToken().safeTransfer(msg.sender, baseTokenAmount);
        shifterRegistry.getShifterByToken(address(reserve.Token())).shiftOut(_tokenAddress, quoteTokenAmount);
    }

    function _doTrade(
        address _src, address _dst, uint256 _minDstAmt, bytes memory _to, uint256 _amount
    ) internal {
        uint256 recvAmt;
        address to;
        IShifter shifter = shifterRegistry.getShifterByToken(address(_dst));

        if (shifter != IShifter(0x0)) {
            to = address(this);
        } else {
            to = _bytesToAddress(_to);
        }

        if (_src == dex.BaseToken()) {
            ERC20(_src).approve(address(dex.reserves(_dst)), _amount);
        } else {
            ERC20(_src).approve(address(dex.reserves(_src)), _amount);
        }
        recvAmt = dex.trade(to, _src, _dst, _amount);

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
        } else {
            ERC20(_src).safeTransferFrom(msg.sender, address(this), _amount);
            return _amount;
        }
    }

    function _bytesToAddress(bytes memory _addr) internal pure returns (address) {
        address addr;
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