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
        bytes memory _secretHash,
        uint256 _maxGasPrice
    ) public Puzzle(
        _registry,
        _tokenSymbol,
        _secretHash,
        _maxGasPrice
    ) {}

    /// @notice Allows someone to try and claim the reward by submitting the secret.
    /// @param _rewardAddress The address that should receive the reward if the secret is correct.
    /// @param _secret The secret.
    function claimReward(bytes memory _rewardAddress, bytes memory _secret) public onlyNotFrontRunning {
        require(!rewardClaimed, "reward already claimed");
        require(validateSecret(_secret), "invalid secret");
        rewardClaimed = true;
        uint256 amount = rewardAmount();
        // Shift out the funds to the specified address
        registry.getShifterBySymbol(tokenSymbol).shiftOut(_rewardAddress, amount);

        emit LogRewardClaimed(_rewardAddress, _secret, amount);
    }
}
