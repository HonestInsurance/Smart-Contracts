/**
 * @description Test script to verify the External Access Interface contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const bn = require('bignumber.js');
const abiExtAccI = artifacts.require("./ExtAccessI.sol");

contract('ExtAccessI', async (accounts) => {
    // variable to store the external access interface instance in
    let extAccI;

    // Function to verify all the variables within the External Access Interface contract
    async function verifyExtAccIntVariables(key0, key1, key2, key3, key4, preAuthKey, preAuthExpirySet) {
        // Verify keys 0, 1, 2, 3 and 4
        expect([key0, key1, key2, key3, key4]).to.be.eql(await extAccI.getExtAccessKey());
        // Verify pre authorised key used
        expect(preAuthKey).to.be.eql(await extAccI.getPreAuthKey());
        // Verify if pre-authorisation expiry timestamp is correct
        if (preAuthExpirySet == false)
            expect(0).to.be.eql((await extAccI.getPreAuthExpiry()).valueOf());
        else expect(0).to.not.eql((await extAccI.getPreAuthExpiry()).valueOf());
    }
  
    it("should deploy a new ExtAccessI contract and verify initialization variables", async () => {
        // Deploy a new contract of IntAccessI and specify account[0] as the initial key to be added as the Deployment Controller address
        extAccI = await abiExtAccI.new(accounts[0]);
        // Verify init variables
        await verifyExtAccIntVariables(accounts[0], 0x0, 0x0, 0x0, 0x0, 0x0, false);
    });

    it("should fail to add a contract address (only externally owned accounts are permitted) submitted by key 0", async () => {
        try {
            // Add a new key - invalid key as it is the the address of a contract deployed
            const tx = await extAccI.addKey(extAccI.address, {from: accounts[0]});
            // The statement below should be unreachable as the above trainsactions must fail
            expect().fail("should throw error");
        } catch (err) { 
            //console.log(err);
        }
        // Verify no key has been added
        await verifyExtAccIntVariables(accounts[0], 0x0, 0x0, 0x0, 0x0, 0x0, false);
    });

    it("should add key 1 with transaction submitted by key 0", async () => {
        // Add a new key
        await extAccI.addKey(accounts[1], {from: accounts[0]});
        // Verify key has been added
        await verifyExtAccIntVariables(accounts[0], accounts[1], 0x0, 0x0, 0x0, 0x0, false);
    });

    it("should add key 2 with transaction submitted by key 1", async () => {
        // Add a new key
        await extAccI.addKey(accounts[2], {from: accounts[1]});
        // Verify key has been added
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], 0x0, 0x0, 0x0, false);
    });

    it("should perform pre-authorisation with key 1, add key 3 with transaction submitted by key 2", async () => {
        // Perform pre-authorisation
        await extAccI.preAuth({from: accounts[1]});
        // Verify preauthorisation
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], 0x0, 0x0, accounts[1], true);
        // Add a new key
        await extAccI.addKey(accounts[3], {from: accounts[2]});
        // Verify key has been added and preauthorisation has been removed
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], accounts[3], 0x0, 0x0, false);
    });

    it("should do pre-auth with key 1, then pre-auth with key 2, add key 4 with transaction submitted by key 1", async () => {
        // Perform pre-authorisation
        await extAccI.preAuth({from: accounts[1]});
        // Verify preauthorisation
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], accounts[3], 0x0, accounts[1], true);
        // Perform another pre-authorisation with a different key (should be possible)
        await extAccI.preAuth({from: accounts[2]});
        // Verify preauthorisation
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], accounts[3], 0x0, accounts[2], true);
        // Add a new key
        await extAccI.addKey(accounts[4], {from: accounts[1]});
        // Verify key has been added and preauthorisation has been removed
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], accounts[3], accounts[4], 0x0, false);
    });

    it("should do pre-auth with key 3 and a key rotation transaction submitted by key 4", async () => {
        // Perform pre-authorisation
        await extAccI.preAuth({from: accounts[3]});
        // Verify preauthorisation
        await verifyExtAccIntVariables(accounts[0], accounts[1], accounts[2], accounts[3], accounts[4], accounts[3], true);
        // Rotate the keys
        await extAccI.rotateKey({from: accounts[4]});
        // Verify keys have been rotated
        await verifyExtAccIntVariables(accounts[1], accounts[2], accounts[3], accounts[4], 0x0, 0x0, false);
    });

    it("should do pre-auth with key in key slot 1 and add key 5 transaction submitted by key slot 3", async () => {
        // Perform pre-authorisation
        await extAccI.preAuth({from: accounts[2]});
        // Verify preauthorisation
        await verifyExtAccIntVariables(accounts[1], accounts[2], accounts[3], accounts[4], 0x0, accounts[2], true);
        // Add a new key
        await extAccI.addKey(accounts[5], {from: accounts[3]});
        // Verify key has been added and preauthorisation has been removed
        await verifyExtAccIntVariables(accounts[1], accounts[2], accounts[3], accounts[4], accounts[5], 0x0, false);
    });
});