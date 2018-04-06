/**
 * @description Deployment script and intialisation of the Insurance Pool ecosystem
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const abiMigrations = artifacts.require("./Migrations.sol");

module.exports = async (deployer, network, accounts) => {
    deployer.then(async () => {
        await deployer.deploy(abiMigrations);
    });
};