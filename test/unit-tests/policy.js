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
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // Get the policy hash
    const policyHash = miscFunc.verifyPolicyLog(logs, 0);
    // Save the policy hash
    td.pHash[policyHashMapInfo.nextIdx.toNumber()] = policyHash;
    
    // 2 Events are triggered as part of the Policy creation
    miscFunc.verifyPolicyLog(logs, 0, policyHash, td.accounts[_policyOwnerAccountIdx], _policyRiskPoints, null, 0);
    miscFunc.verifyPolicyLog(logs, 1, policyHash, td.accounts[_policyOwnerAccountIdx], miscFunc.getIdxHash(_policyRiskPoints), null, 0);

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(policyHash), policyHashMapInfo.nextIdx.toNumber(), td.accounts[_policyOwnerAccountIdx], null, miscFunc.getIdxHash(_policyRiskPoints), _policyRiskPoints, 0, 0, 0);
    
    // Verify the adjustor has been added to the hash map
    miscFunc.verifyHashMap(policyHashMapInfo, await td.policy.hashMap(), true);
}

// updatePolicy(bytes32 _adjustorHash, bytes32 _policyHash, bytes32 _policyDocumentHash, uint _policyRiskPoints) 
exports.updatePolicy = async (_policyHash, _policyRiskPoints, _adjustorIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();

    // Update the policy
    const tx = await td.policy.updatePolicy(td.aHash[_adjustorIdx], _policyHash, miscFunc.getIdxHash(_policyRiskPoints), _policyRiskPoints, {from: td.accounts[_adjustorIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // 2 Events are triggered as part of the Policy creation
    miscFunc.verifyPolicyLog(logs, 0, _policyHash, initialPolicyData.owner, _policyRiskPoints, null, initialPolicyData.state.toNumber());
    miscFunc.verifyPolicyLog(logs, 1, _policyHash, initialPolicyData.owner, miscFunc.getIdxHash(_policyRiskPoints), null, initialPolicyData.state.toNumber());
    
    // Get the new total policy risk points
    const newPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();
   
    // In case the policy is in an Issued state
    if (initialPolicyData[7].toNumber() == 1) {
        // Ensure the new value for total policy risk points is correct
        expect(newPoints).to.be.equal(+td.totalRiskPoints - +initialPolicyData[4].toNumber() + +_policyRiskPoints);
    }
    else {
        // Ensure the value for policy risk points did NOT change
        expect(newPoints).to.be.equal(td.totalRiskPoints);
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
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();

    // Suspend the policy
    const tx = await td.policy.suspendPolicy(_policyHash, {from: td.accounts[_policyOwnerAccountIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);
    
    // Verify the policy event log
    miscFunc.verifyPolicyLog(logs, 0, _policyHash, td.accounts[_policyOwnerAccountIdx], miscFunc.getEmptyHash(), null, 0);

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), initialPolicyData.idx.toNumber(), initialPolicyData.owner, initialPolicyData.paymentAccountHash, null, initialPolicyData.riskPoints.toNumber(), null, null, 0, td.currentPoolDay, td.currentPoolDay + setupI.MAX_DURATION_POLICY_PAUSED_DAY);

    // Remove the risk points
    td.totalRiskPoints -= +initialPolicyData.riskPoints.toNumber();

    // Verify the total number of Risk points in the policy contract is correct
    expect(td.totalRiskPoints).to.be.equal((await td.policy.totalIssuedPolicyRiskPoints()).toNumber());
}

// unsuspendPolicy(bytes32 _policyHash)
exports.unsuspendPolicy = async (_policyHash, _policyOwnerAccountIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();

    // Suspend the policy
    const tx = await td.policy.unsuspendPolicy(_policyHash, {from: td.accounts[_policyOwnerAccountIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);
    
    // Verify the policy event log
    miscFunc.verifyPolicyLog(logs, 0, _policyHash, td.accounts[_policyOwnerAccountIdx], miscFunc.getEmptyHash(), null, 1);

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), initialPolicyData.idx.toNumber(), initialPolicyData.owner, initialPolicyData.paymentAccountHash, null, initialPolicyData.riskPoints.toNumber(), null, null, 1, td.currentPoolDay, null);

    // Add the risk points
    td.totalRiskPoints = +td.totalRiskPoints + +initialPolicyData.riskPoints.toNumber();

    // Verify the total number of Risk points in the policy contract is correct
    expect(td.totalRiskPoints).to.be.equal((await td.policy.totalIssuedPolicyRiskPoints()).toNumber());
}

// retirePolicy(bytes32 _policyHash)
exports.retirePolicy = async (_policyHash, _policyOwnerAccountIdx) => {
    // Save the policy data
    const initialPolicyData = await td.policy.dataStorage(_policyHash);
    // Save the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();

    // Retire the policy
    const tx = await td.policy.retirePolicy(_policyHash, {from: td.accounts[_policyOwnerAccountIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);
    
    // Verify the policy event log
    miscFunc.verifyPolicyLog(logs, 0, _policyHash, td.accounts[_policyOwnerAccountIdx], miscFunc.getEmptyHash(), null, 4);

    // Call the function to verify all policy data
    await miscFunc.verifyPolicyData(await td.policy.dataStorage.call(_policyHash), initialPolicyData.idx.toNumber(), initialPolicyData.owner, initialPolicyData.paymentAccountHash, null, initialPolicyData.riskPoints.toNumber(), null, null, 4, td.currentPoolDay, null);

    // If policy to retire is in an Issued state remove the policy risk points
    if (initialPolicyData.state.toNumber() == 1)
        td.totalRiskPoints -= +initialPolicyData.riskPoints.toNumber();

    // Verify the total number of Risk points in the policy contract is correct
    expect(td.totalRiskPoints).to.be.equal((await td.policy.totalIssuedPolicyRiskPoints()).toNumber());
}