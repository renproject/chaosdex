pragma solidity ^0.5.12;

import "./Puzzle.sol";

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";
import "darknode-sol/contracts/libraries/Compare.sol";

contract ShiftInPuzzle is Puzzle {
    using SafeMath for uint256;

    /// @param _registry The Shifter registry contract address
    /// @param _tokenSymbol The token symbol for the reward and the shifting
    /// @param _secretHash The secret hash
    /* solium-disable-next-line no-empty-blocks */
    constructor(
        ShifterRegistry _registry,
        string memory _tokenSymbol,
        bytes memory _secretHash,
        uint256 _maxGasPrice
    ) public Puzzle(
        _registry,
        _tokenSymbol,
        _secretHash,
        _maxGasPrice
    ) {}

    /// @notice Allows someone to try and claim the reward by submitting the secret.
    /// @param _rewardAddress The address that should receive the shiftedOut tokens and the potential reward.
    /// @param _secret The secret.
    /// @param _amount The amount of token provided to the Darknodes in Sats.
    /// @param _nHash The hash of the nonce returned by the Darknodes.
    /// @param _sig The signature returned by the Darknodes.
    function claimReward(
        // Payload
        bytes memory _rewardAddress,
        bytes memory _secret,
        // Required
        uint256      _amount,
        bytes32      _nHash,
        bytes memory _sig
    ) public onlyNotFrontRunning {
        require(_amount > 0, "amount must be greater than 0");
        uint256 prizeAmount = rewardAmount();

        // Construct the payload hash and verify the signature to ensure the Darknodes have
        // received the token.
        bytes32 pHash = hashPayload(_rewardAddress, _secret);
        uint256 transferAmount = registry.getShifterBySymbol(tokenSymbol).shiftIn(pHash, _amount, _nHash, _sig);

        // If the secret is correct, give the reward
        if (validateSecret(_secret) && !rewardClaimed) {
            rewardClaimed = true;
            transferAmount = transferAmount.add(prizeAmount);
            emit LogRewardClaimed(_rewardAddress, _secret, prizeAmount);
        }

        // Shift out the funds to the specified address
        registry.getShifterBySymbol(tokenSymbol).shiftOut(_rewardAddress, transferAmount);
    }

    /// @notice Get the hash payload
    ///
    /// @param _rewardAddress The address that should receive the shiftedOut tokens and the potential reward.
    /// @param _secret The secret.
    function hashPayload(
        bytes memory _rewardAddress,
        bytes memory _secret
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(_rewardAddress, _secret));
    }
}
