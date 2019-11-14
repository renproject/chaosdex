pragma solidity ^0.5.12;

import "../DEXAdapter.sol";
import "../DEXReserve.sol";
import "../DEX.sol";
import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";
import "darknode-sol/contracts/Shifter/IShifter.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract DEXChallenge is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    DEXAdapter public dexAdapter;
    ShifterRegistry public registry;

    address public btcAddr;
    address public zecAddr;

    DEXReserve public btcDEXReserve;
    DEXReserve public zecDEXReserve;

    bool public rewardClaimed;       // Whether someone has already claimed the prize or not
    uint256 public btcRewardAmount;  // The amount of BTC available as reward for this challenge
    uint256 public zecRewardAmount;  // The amount of ZEC available as reward for this challenge

    /// @param _dexAdapter The address of the dex adapter
    constructor(DEXAdapter _dexAdapter) public {
        dexAdapter = _dexAdapter;
        registry = ShifterRegistry(_dexAdapter.shifterRegistry());
        btcAddr = registry.getTokenBySymbol("zBTC");
        zecAddr = registry.getTokenBySymbol("zZEC");
        btcDEXReserve = DEXReserve(DEX(dexAdapter.dex()).reserves(btcAddr));
        zecDEXReserve = DEXReserve(DEX(dexAdapter.dex()).reserves(zecAddr));
    }

    /// @notice Funds the challenge contract with BTC funds for rewards.
    /// @param _amount The amount of Bitcoin to be shifted in.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    function fundBTC(
        // Required
        uint256      _amount,
        bytes32      _nHash,
        bytes memory _sig
    ) public {
        require(_amount > 0, "amount must be greater than 0");
        uint256 transferAmount = registry.getShifterByToken(btcAddr).shiftIn(0x0, _amount, _nHash, _sig);
        btcRewardAmount = btcRewardAmount.add(transferAmount);
    }

    /// @notice Funds the challenge contract with ZEC funds for rewards.
    /// @param _amount The amount of Zcash to be shifted in.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    function fundZEC(
        // Required
        uint256      _amount,
        bytes32      _nHash,
        bytes memory _sig
    ) public {
        require(_amount > 0, "amount must be greater than 0");
        uint256 transferAmount = registry.getShifterByToken(zecAddr).shiftIn(0x0, _amount, _nHash, _sig);
        zecRewardAmount = zecRewardAmount.add(transferAmount);
    }

    /// @notice The function conducts the BTC <-> ZEC trade and if completes successfully
    ///         also gives a bonus reward.
    ///
    /// @param _srcToken          Must be the zBTC token address to be eligible for reward.
    /// @param _dstToken          Must be the zZEC token address to be eligible for reward.
    /// @param _minDstAmount      The minimum amount of ZEC to receive from the swap.
    /// @param _to                The ZEC address at which to receive the funds and any ZEC reward.
    /// @param _refundBlockNumber The block number for when funds should be refunded.
    /// @param _refundAddress     The BTC address for refunds and any BTC reward.
    /// @param _amount            The amount of Bitcoin provided to the Darknodes in Sats.
    /// @param _nHash             The hash of the nonce returned by the Darknodes.
    /// @param _sig               The signature returned by the Darknodes.
    function trade(
        // Payload
        address _srcToken,
        address _dstToken,
        uint256 _minDstAmount,
        bytes calldata _to,
        uint256 _refundBlockNumber,
        bytes calldata _refundAddress,
        // Required
        uint256 _amount, bytes32 _nHash, bytes calldata _sig
    ) external {
        // Save balances to ensure correct swap
        uint256 initResBtcBalance = ERC20(btcAddr).balanceOf(address(btcDEXReserve));
        uint256 initResZecBalance = ERC20(zecAddr).balanceOf(address(zecDEXReserve));

        // Make the trade
        dexAdapter.trade(_srcToken, _dstToken, _minDstAmount, _to, _refundBlockNumber, _refundAddress, _amount, _nHash, _sig);

        // Check the balance again
        uint256 postResBtcBalance = ERC20(btcAddr).balanceOf(address(btcDEXReserve));
        uint256 postResZecBalance = ERC20(zecAddr).balanceOf(address(zecDEXReserve));

        bool success = _successfulTrade(
            initResBtcBalance,
            postResBtcBalance,
            initResZecBalance,
            postResZecBalance
        );

        // Trade was successful
        if (success && !rewardClaimed) {
            // Transfer ZEC reward to the user
            if (zecRewardAmount > 0) {
                _shiftOut(zecAddr, _to, zecRewardAmount);
                zecRewardAmount = 0;
            }
            // Transfer BTC reward to the user
            if (btcRewardAmount > 0) {
                _shiftOut(btcAddr, _refundAddress, btcRewardAmount);
                btcRewardAmount = 0;
            }
            rewardClaimed = true;
        }
    }

    /// @notice Shifts out BTC from the contract to reduce the reward distributed.
    ///
    /// @param _address The BTC address to shift Bitcoin out to
    /// @param _amount  The amount to shift out
    function shiftOutBtc(bytes calldata _address, uint256 _amount) external onlyOwner {
        _shiftOut(btcAddr, _address, _amount);
        btcRewardAmount = btcRewardAmount.sub(_amount);
    }

    /// @notice Shifts out ZEC from the contract to reduce the reward distributed.
    ///
    /// @param _address The ZEC address to shift ZEC out to
    /// @param _amount  The amount to shift out
    function shiftOutZec(bytes calldata _address, uint256 _amount) external onlyOwner {
        _shiftOut(zecAddr, _address, _amount);
        zecRewardAmount = zecRewardAmount.sub(_amount);
    }

    function _shiftOut(address _token, bytes memory _address, uint256 _amount) internal {
        registry.getShifterByToken(_token).shiftOut(_address, _amount);
    }

    function _successfulTrade(
        uint256 _initResBtcBalance,
        uint256 _postResBtcBalance,
        uint256 _initResZecBalance,
        uint256 _postResZecBalance
    ) internal pure returns (bool) {
        return (
            _initResBtcBalance < _postResBtcBalance &&
            _initResZecBalance > _postResZecBalance
        );
    }

}