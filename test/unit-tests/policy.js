/**
 * @description Unit tests for verifying Policy contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

// Load the java script files to access their functions
const expect = require('expect.js');
const bn = require('bignumber.js');
const miscFunc = require("../misc/miscFunc.js");
const setupI = require("../misc/setupI.js");
const td = require("../misc/testData.js");

// --- Solidity Contract Info ---
// contract Policy is SetupI, IntAccessI, NotificationI, HashMapI
// event LogPolicy(bytes32 indexed policyHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
// idx                             0                           1                      2          3               4
// ----------------

// createPolicy(bytes32 _adjustorHash, address _policyOwnerAdr, bytes32 _policyDocumentHash, uint _policyRiskPoints) 
exports.createPolicy = async (_policyRiskPoints, _policyOwnerAccountIdx, _adjustorIdx) => {
    // Store the hash map info for now
    const policyHashMapInfo = await td.policy.hashMap();
    // Create a new Adjustor via the trust contract signing with the Trust's authorisation keys
    const tx = await td.policy.createPolicy(td.aHash[_adjustorIdx], td.accounts[_policyOwnerAccountIdx], miscFunc.getIdxHash(_policyRiskPoints), _policyRiskPoints, {from: td.accounts[_adjustorIdx]});

    // Get the policy hash
    const policyHash = miscFunc.eventLog('Policy', tx, 0, 0);
    // Save the policy hash
    td.pHash[policyHashMapInfo[1].valueOf()] = policyHash;
    
    // 2 Events are triggered as part of the policy creation
    expect(policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 0, 0));
    expect(td.accounts[_policyOwnerAccountIdx]).to.be.eql( miscFunc.getAdrFromBytes32(miscFunc.eventLog('Policy', tx, 0, 1)));
    expect(_policyRiskPoints).to.be.eql( parseInt(miscFunc.eventLog('Policy', tx, 0, 2)));
    expect(0).to.be.eql( parseInt(miscFunc.eventLog('Policy', tx, 0, 4)));
    
    expect(policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 1, 0));
    expect(td.accounts[_policyOwnerAccountIdx]).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Policy', tx, 1, 1)));
    expect(miscFunc.getIdxHash(_policyRiskPoints)).to.be.eql(miscFunc.eventLog('Policy', tx, 1, 2));
    expect(0).to.be.eql(parseInt(miscFunc.eventLog('Policy', tx, 1, 4)));

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(policyHash), policyHashMapInfo[1].valueOf(), td.accounts[_policyOwnerAccountIdx], null, miscFunc.getIdxHash(_policyRiskPoints), _policyRiskPoints, 0, 0, 0);
    
    // Verify the adjustor has been added to the hash map
    miscFunc.verifyHashMap(policyHashMapInfo, await td.policy.hashMap(), true);
}

// updatePolicy(bytes32 _adjustorHash, bytes32 _policyHash, bytes32 _policyDocumentHash, uint _policyRiskPoints) 
exports.updatePolicy = async (_policyHash, _policyRiskPoints, _adjustorIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).valueOf();

    // Update the policy
    const tx = await td.policy.updatePolicy(td.aHash[_adjustorIdx], _policyHash, miscFunc.getIdxHash(_policyRiskPoints), _policyRiskPoints, {from: td.accounts[_adjustorIdx]});
    
    // 2 Events are triggered as part of the policy update
    expect(_policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 0, 0));
    expect(_policyRiskPoints).to.be.eql(parseInt(miscFunc.eventLog('Policy', tx, 0, 2)));

    expect(_policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 1, 0));
    expect(miscFunc.getIdxHash(_policyRiskPoints)).to.be.eql(miscFunc.eventLog('Policy', tx, 1, 2));
    
    // Get the new total policy risk points
    const newPoints = (await td.policy.totalIssuedPolicyRiskPoints()).valueOf();
   
    // In case the policy is in an Issued state
    if (initialPolicyData[7].valueOf() == 1) {
        // Ensure the new value for total policy risk points is correct
        expect(newPoints).to.be.eql(+td.totalRiskPoints - +initialPolicyData[4].valueOf() + +_policyRiskPoints);
    }
    else {
        // Ensure the value for policy risk points did NOT change
        expect(newPoints).to.be.eql(td.totalRiskPoints);
    }

    // Save the new value for total policy risk points
    td.totalRiskPoints = newPoints;

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), null, null, null, miscFunc.getIdxHash(_policyRiskPoints), _policyRiskPoints, null, null, null);
}

// suspendPolicy(bytes32 _policyHash)
exports.suspendPolicy = async (_policyHash, _policyOwnerAccountIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).valueOf();

    // Suspend the policy
    const tx = await td.policy.suspendPolicy(_policyHash, {from: td.accounts[_policyOwnerAccountIdx]});
    
    // Verify the policy event log
    expect(_policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 0, 0));
    expect(td.accounts[_policyOwnerAccountIdx]).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Policy', tx, 0, 1)));
    expect(0).to.be.eql(parseInt(miscFunc.eventLog('Policy', tx, 0, 4)));

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), initialPolicyData[0].valueOf(), initialPolicyData[1], initialPolicyData[2], null, initialPolicyData[4].valueOf(), null, null, 0, td.currentPoolDay, td.currentPoolDay + setupI.MAX_DURATION_POLICY_PAUSED_DAY);

    // Remove the risk points
    td.totalRiskPoints -= +initialPolicyData[4].valueOf();

    // Verify the total number of Risk points in the policy contract is correct
    expect(td.totalRiskPoints).to.be.eql((await td.policy.totalIssuedPolicyRiskPoints()).valueOf());
}

// unsuspendPolicy(bytes32 _policyHash)
exports.unsuspendPolicy = async (_policyHash, _policyOwnerAccountIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).valueOf();

    // Suspend the policy
    const tx = await td.policy.unsuspendPolicy(_policyHash, {from: td.accounts[_policyOwnerAccountIdx]});
    
    // Verify the policy event log
    expect(_policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 0, 0));
    expect(td.accounts[_policyOwnerAccountIdx]).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Policy', tx, 0, 1)));
    expect(1).to.be.eql(parseInt(miscFunc.eventLog('Policy', tx, 0, 4)));

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), initialPolicyData[0].valueOf(), initialPolicyData[1], initialPolicyData[2], null, initialPolicyData[4].valueOf(), null, null, 1, td.currentPoolDay, null);

    // Add the risk points
    td.totalRiskPoints = +td.totalRiskPoints + +initialPolicyData[4].valueOf();

    // Verify the total number of Risk points in the policy contract is correct
    expect(td.totalRiskPoints).to.be.eql((await td.policy.totalIssuedPolicyRiskPoints()).valueOf());
}

// retirePolicy(bytes32 _policyHash)
exports.retirePolicy = async (_policyHash, _policyOwnerAccountIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).valueOf();

    // Retire the policy
    const tx = await td.policy.retirePolicy(_policyHash, {from: td.accounts[_policyOwnerAccountIdx]});
    
    // Verify the policy event log
    expect(_policyHash).to.be.eql(miscFunc.eventLog('Policy', tx, 0, 0));
    expect(td.accounts[_policyOwnerAccountIdx]).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Policy', tx, 0, 1)));
    expect(4).to.be.eql(parseInt(miscFunc.eventLog('Policy', tx, 0, 4)));

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), initialPolicyData[0].valueOf(), initialPolicyData[1], initialPolicyData[2], null, initialPolicyData[4].valueOf(), null, null, 4, td.currentPoolDay, null);

    // If policy to retire is in an Issued state remove the policy risk points
    if (initialPolicyData[7].valueOf() == 1)
        td.totalRiskPoints -= +initialPolicyData[4].valueOf();

    // Verify the total number of Risk points in the policy contract is correct
    expect(td.totalRiskPoints).to.be.eql((await td.policy.totalIssuedPolicyRiskPoints()).valueOf());
}