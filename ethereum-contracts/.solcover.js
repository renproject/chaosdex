module.exports = {
    copyPackages: ["darknode-sol", "openzeppelin-solidity"], // needed to import from node_modules
    testrpcOptions: "-d --accounts 10 --port 8555",
    skipFiles: [
        "Migrations.sol",
        "test/TestToken.sol"
    ],
};
