/**
 * @description Various helper functions required for testing the contacts
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const bn = require('bignumber.js');
const setupI = require("../misc/setupI.js");
const td = require("../misc/testData.js");

// Sleeps for the requested time period in milli seconds
exports.sleep = function(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}  

// Extracts from a byte32 value the address parameter and returns it
exports.getAdrFromBytes32 = function(bte) {
    return '0x' + bte.toString().substring(26, 66);
}

// Returns an address value as a 32byte value by inserting enought 0
exports.getBytes32FromAdr = function(adr) {
    return adr.slice(0, 2) + "000000000000000000000000" + adr.slice(2);
}

// Uses the EPOCH and creates a local readable date time string
exports.getLocalDateStringFromEpoch = function(str) {
    var d = new Date(0);
    d.setUTCSeconds(str.valueOf());

    var yy = d.getFullYear();
    var mm = d.getMonth() + 1; // getMonth() is zero-based
    var dd = d.getDate();
    var hh = d.getHours();
    var mi = d.getMinutes();
    var ss = d.getSeconds();

    var part1 = [
            yy, 
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd,
            ].join('-');

    var part2 = [
            (hh>9 ? '' : '0') + hh,
            (mi>9 ? '' : '0') + mi,
            (ss>9 ? '' : '0') + ss
            ].join(':');

    return part1 + ' ' + part2;
}

// Converts the provided hex string to ASCII string
exports.hexToAscii = function(str, len) {
    len = len ? ((len + 1) * 2) : 1000;

    var hex  = str.toString();
    var str = '';

    for (var n = 2; ((n < hex.length) && (n < len)); n += 2) {
        if (parseInt(hex.substr(n, 2), 16) > 31)
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        else str += String.fromCharCode(32);
    }
    return str;
}

// Shortens the provided hash to save some screen space
exports.shortenHash = function(hash) {
    return hash.substring(0, 6) + '...' + hash.substring(62, 66);
}

// Formats the provided number
exports.formatNr = function(val, isCurrency, length, allignLeft, thousandSeparator) {
    var templateStr = "                                                                            ";
    var paddingLenghString = templateStr.slice(0, length - 1);
    // If it is a currency format accordingly with $-symbol, alligned right, punctuation, and 2 digits
    if (isCurrency) {
        if (val != 0) {
            var str = (val / 100).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
            return '$' + (paddingLenghString + str).slice(-paddingLenghString.length);
        }
        else {
            return paddingLenghString + '-';
        }
    }
    // If it is a number
    else {
        // Create the number with toString either with or without thousand separator
        if (thousandSeparator == true)
            var strNumber = val.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
        else var strNumber = val.toString();

        // Allign the number and add padding
        if (allignLeft == true) {
            return (strNumber + templateStr).substr(0, length);
        }
        else {
            var help = templateStr + strNumber + '   ';
            return help.substr(help.length - length, length);
        }
    }
}

// function getBondPaymentAccountHashSender(idx) { return web3.sha3('Sam Smith Bond '+ idx + '12-55555-123456-00' + idx); }
exports.getRandomHash = function() { var d = new Date(); return web3.sha3('Some random string' + d.getMilliseconds()); }
exports.getEmptyHash = function() { return "0x0000000000000000000000000000000000000000000000000000000000000000"; }
exports.getIdxHash = function(idx) { return web3.sha3('Some random string' + idx); }


exports.getAdjustorServiceAgreement = function(idx) { return web3.sha3('Sam Smith Adjustor '+ idx); }
exports.getSettlementDocument = function (idx) { return web3.sha3('Settlement document '+ idx); }
exports.getPolicyDocument = function() { return 'Policy 123 Document'; };
exports.getPolicyDocumentHash = function() { return web3.sha3('Policy 123 Document'); };


// Calculates the combined and updcoming bond maturity payout amounts for the next 3 days
exports.getBondMaturityPaymentsNext3Days = function() {
    var sum = 0;
    if (td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 0] != null) sum = +sum + +td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 0];
    if (td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 1] != null) sum = +sum + +td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 1];
    if (td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 2] != null) sum = +sum + +td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 2];
    return sum;
}

// Calculates the averabe bond maturity payments for the future averages accross the planing horizon
exports.getBondMaturityPaymentsAveragePerDay = function() {
    var sum = 0;
    var lastDay = (setupI.DURATION_TO_BOND_MATURITY_SEC / (3600 * 24)) + +td.currentPoolDay;
    for (var i=td.currentPoolDay; i<=lastDay; i++) {
        if (td.bondMaturityPayoutsEachDay[i] != null) {
            sum = +sum + +td.bondMaturityPayoutsEachDay[i];
        }
    }
    return Math.floor(sum / (setupI.DURATION_TO_BOND_MATURITY_SEC / (3600 * 24)));
}

// Returns a single requested value from the event log files as specified by the parameters provided
exports.eventLog = function(contract, tx, logNr, idx) {
    // POOL
    // event LogPool(bytes32 indexed subject, uint indexed day, uint indexed value, uint timestamp);
    // idx                           0                        1                    2          3  
    if (contract == 'Pool')
    {
        if (idx == 0) return tx.receipt.logs[logNr].topics[1];                                      // bytes32 subject
        if (idx == 1) return parseInt(tx.receipt.logs[logNr].topics[2]);                            // uint day
        if (idx == 2) return parseInt(tx.receipt.logs[logNr].topics[3]);                            // uint value
        if (idx == 3) return tx.receipt.logs[logNr].data.slice(2 + 0 * 64, 2 + 1 * 64).valueOf();   // uint timestamp
    }

    // TRUST
    // event LogTrust(bytes32 indexed subject, address indexed adr, bytes32 indexed info, uint timestamp);
    // idx                           0                        1                    2          3  
    else if (contract == 'Trust')
    {
        if (idx == 0) return tx.receipt.logs[logNr].topics[1];                                      // bytes32 subject
        if (idx == 1) return tx.receipt.logs[logNr].topics[2];                                      // address adr
        if (idx == 2) return tx.receipt.logs[logNr].topics[3];                                      // bytes32 info
        if (idx == 3) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 0 * 64, 2 + 1 * 64);      // uint timestamp
    }

    // BOND and POLICY
    // event LogBond  (bytes32 indexed bondHash,   address indexed owner, bytes32 indexed info, uint timestamp, uint state);
    // event LogPolicy(bytes32 indexed policyHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
    // idx                           0                         1                      2          3               4
    else if ((contract == 'Bond') || (contract == 'Policy'))
    {    
        if (idx == 0) return tx.receipt.logs[logNr].topics[1];                                      // bytes32 hash
        if (idx == 1) return tx.receipt.logs[logNr].topics[2];                                      // address owner
        if (idx == 2) return tx.receipt.logs[logNr].topics[3]                                       // bytes32 info
        if (idx == 3) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 0 * 64, 2 + 1 * 64);      // uint timestamp
        if (idx == 4) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 1 * 64, 2 + 2 * 64);      // uint state        
    }

    // ADJUSTOR
    // event LogAdjustor(bytes32 indexed adjustorHash, address indexed owner, bytes32 indexed info, uint timestamp);
    // idx                               0                             1                      2          3
    else if (contract == 'Adjustor')
    {    
        if (idx == 0) return tx.receipt.logs[logNr].topics[1];                                      // bytes32 adjustorHash
        if (idx == 1) return tx.receipt.logs[logNr].topics[2];                                      // address owner
        if (idx == 2) return tx.receipt.logs[logNr].topics[3]                                       // bytes32 info
        if (idx == 3) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 0 * 64, 2 + 1 * 64);      // uint timestamp        
    }

    // SETTLEMENT
    // event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
    // idx                                 0                               1                             2          3               4
    else if (contract == 'Settlement')
    {    
        if (idx == 0) return tx.receipt.logs[logNr].topics[1];                                      // bytes32 settlementHash
        if (idx == 1) return tx.receipt.logs[logNr].topics[2];                                      // bytes32 adjustorHash
        if (idx == 2) return tx.receipt.logs[logNr].topics[3]                                       // bytes32 info
        if (idx == 3) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 0 * 64, 2 + 1 * 64);      // uint timestamp   
        if (idx == 4) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 1 * 64, 2 + 2 * 64);      // uint state           
    }

    // BANK TRANSACTION
    // event LogBank(bytes32 indexed internalReferenceHash, uint indexed accountType, bool indexed success,
    // idx                                             0                                   1                         2
    //     bytes32 paymentAccountHash, bytes32 paymentSubject, bytes32 info, 
    // idx         3                           4                       5
    //     uint timestamp uint transactionType, uint amount);
    // idx      6               7                    8
    else if (contract == 'Bank')
    {
        if (idx == 0) return tx.receipt.logs[logNr].topics[1];                                      // bytes32 internalReferenceHash
        if (idx == 1) return tx.receipt.logs[logNr].topics[2];                                      // uint accountType
        if (idx == 2) return tx.receipt.logs[logNr].topics[3];                                      // bool success
        if (idx == 3) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 0 * 64, 2 + 1 * 64);      // bytes32 paymentAccountHash
        if (idx == 4) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 1 * 64, 2 + 2 * 64);      // string paymentSubject
        if (idx == 5) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 2 * 64, 2 + 3 * 64);      // bytes32 info
        if (idx == 6) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 3 * 64, 2 + 4 * 64);      // uint timestamp
        if (idx == 7) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 4 * 64, 2 + 5 * 64);      // uint transactionType
        if (idx == 8) return '0x' + tx.receipt.logs[logNr].data.slice(2 + 5 * 64, 2 + 6 * 64);      // uint amount
    }
}

// Function verifies all contract addresses specified for any of the dependent contracts
exports.verifyAllContractReferenceAdr = function(idx, contractAdrMsg, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef) {
    expect(poolAdrRef[idx]).to.be.eql(bondAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.eql(bankAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.eql(policyAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.eql(settlementAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.eql(adjustorAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.eql(timerAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.eql(trustAdrRef[idx]);
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifyBondData = function(_data, _idx, _owner, _paymentAccountHash, _principal_Cu, 
    _yield_Ppb, _maturityPayoutAmount_Cu, _creationDate,
    _nextStateExpiryDate, _maturityDate, _state, _securityReferenceHash) 
{
    // If a parameter has been provided verify it matches _data
    if (_idx != null)                           expect(_data[0].valueOf()).to.be.eql(_idx);
    if (_owner != null)                         expect(_data[1].valueOf()).to.be.eql(_owner);
    if (_paymentAccountHash != null)            expect(_data[2].valueOf()).to.be.eql(_paymentAccountHash);
    if (_principal_Cu != null)                  expect(_data[3].valueOf()).to.be.eql(_principal_Cu);
    if (_yield_Ppb != null)                     expect(_data[4].valueOf()).to.be.eql(_yield_Ppb);
    if (_maturityPayoutAmount_Cu != null)       expect(_data[5].valueOf()).to.be.eql(_maturityPayoutAmount_Cu);
    if (_creationDate != null)                  expect(_data[6].valueOf()).to.be.eql(_creationDate);
    if (_nextStateExpiryDate != null)           expect(_data[7].valueOf()).to.be.eql(_nextStateExpiryDate);
    if (_maturityDate != null)                  expect(_data[8].valueOf()).to.be.eql(_maturityDate);
    if (_state != null)                         expect(_data[9].valueOf()).to.be.eql(_state);
    if (_securityReferenceHash != null)         expect(_data[10].valueOf()).to.be.eql(_securityReferenceHash);
    // Return dummy value to be awaited
    return 0;
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifyPolicyData = function(_data, _idx, _owner, _paymentAccountHash, _documentHash, 
    _riskPoints, _premiumCredited_Cu, _premiumCharged_Cu_Ppt, _state, _lastReconciliationDay, _nextReconciliationDay) 
{
    if (_idx != null)                           expect(_data[0].valueOf()).to.be.eql(_idx);
    if (_owner != null)                         expect(_data[1].valueOf()).to.be.eql(_owner);
    if (_paymentAccountHash != null)            expect(_data[2].valueOf()).to.be.eql(_paymentAccountHash);
    if (_documentHash != null)                  expect(_data[3].valueOf()).to.be.eql(_documentHash);
    if (_riskPoints != null)                    expect(_data[4].valueOf()).to.be.eql(_riskPoints);
    if (_premiumCredited_Cu != null)            expect(_data[5].valueOf()).to.be.eql(_premiumCredited_Cu);
    if (_premiumCharged_Cu_Ppt != null)         expect(_data[6].valueOf()).to.be.eql(_premiumCharged_Cu_Ppt);
    if (_state != null)                         expect(_data[7].valueOf()).to.be.eql(_state);
    if (_lastReconciliationDay != null)         expect(_data[8].valueOf()).to.be.eql(_lastReconciliationDay);
    if (_nextReconciliationDay != null)         expect(_data[9].valueOf()).to.be.eql(_nextReconciliationDay);
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifyAdjustorData = function(_data, _idx, _owner, _settlementApprovalAmount_Cu, _policyRiskPointLimit, _serviceAgreement) 
{
    if (_idx != null)                           expect(_data[0].valueOf()).to.be.eql(_idx);
    if (_owner != null)                         expect(_data[1].valueOf()).to.be.eql(_owner);
    if (_settlementApprovalAmount_Cu != null)   expect(_data[2].valueOf()).to.be.eql(_settlementApprovalAmount_Cu);
    if (_policyRiskPointLimit != null)          expect(_data[3].valueOf()).to.be.eql(_policyRiskPointLimit);
    if (_serviceAgreement != null)              expect(_data[4].valueOf()).to.be.eql(_serviceAgreement);
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifySettlementData = function(_data, _idx, _settlementAmount_Cu, _state) 
{
    if (_idx != null)                           expect(_data[0].valueOf()).to.be.eql(_idx);
    if (_settlementAmount_Cu != null)           expect(_data[1].valueOf()).to.be.eql(_settlementAmount_Cu);
    if (_state != null)                         expect(_data[2].valueOf()).to.be.eql(_state);
}

// Function compares the difference between two hash maps (first, next and count)
exports.verifyHashMap = function(_beforeHashMap, _afterHashMap, _added)
{
    // A new hash has been added to the hash map
    if (_added == true) {
        expect(+_beforeHashMap[1].valueOf() + +1).to.be.eql(+_afterHashMap[1].valueOf());
        expect(+_beforeHashMap[2].valueOf() + +1).to.be.eql(+_afterHashMap[2].valueOf());
    }
    // The hash map has not changed
    else if (_added == null) {
        expect(_beforeHashMap[1].valueOf()).to.be.eql(+_afterHashMap[1].valueOf());
        expect(_beforeHashMap[2].valueOf()).to.be.eql(+_afterHashMap[2].valueOf());
    }
    // A hash has been 'removed' (archived)
    else if (_added == false) {
        expect(_beforeHashMap[1].valueOf()).to.be.eql(+_afterHashMap[1].valueOf());
        expect(_beforeHashMap[2].valueOf()).to.be.eql(+_afterHashMap[2].valueOf() + +1);
    }
}