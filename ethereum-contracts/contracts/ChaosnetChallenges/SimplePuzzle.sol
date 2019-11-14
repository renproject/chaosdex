pragma solidity ^0.5.12;

import "./Puzzle.sol";

import "darknode-sol/contracts/Shifter/ShifterRegistry.sol";

contract SimplePuzzle is Puzzle {
    /// @param _registry The Shifter registry contract address
    /// @param _tokenSymbol The token symbol for the reward and the shifting
    /// @param _secretHash The secret hash
    /* solium-disable-next-line no-empty-blocks */
    constructor(
        ShifterRegistry _registry,
        string memory _tokenSymbol,
        bytes memory _secretHash
    ) public Puzzle(
        _registry,
        _tokenSymbol,
        _secretHash
    ) {}

    /// @notice Allows someone to try and claim the reward by submitting the secret.
    /// @param _refundAddress The address that should receive the shiftedOut tokens and the potential reward.
    /// @param _secret The secret.
    function claimReward(bytes memory _refundAddress, bytes memory _secret) public {
        require(!rewardClaimed, "reward already claimed");
        require(validateSecret(_secret), "invalid secret");
        rewardClaimed = true;
        // Shift out the funds to the specified address
        registry.getShifterBySymbol(tokenSymbol).shiftOut(_refundAddress, rewardAmount);

        // Reset the reward amount
        rewardAmount = 0;
    }
}
