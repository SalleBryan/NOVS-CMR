'use strict';

/**
 * Single import point for the whole ODM layer.
 *   const { Voter, Election } = require('./src/models');
 */
module.exports = {
  ElectoralDistrict: require('./ElectoralDistrict'),
  ElecamBranch: require('./ElecamBranch'),
  PoliticalParty: require('./PoliticalParty'),
  PollingStation: require('./PollingStation'),
  PollingOfficial: require('./PollingOfficial'),
  Voter: require('./Voter'),
  Election: require('./Election'),
  Candidate: require('./Candidate'),
  VoterParticipation: require('./VoterParticipation'),
  Vote: require('./Vote'),
  Result: require('./Result'),
  FacialVerification: require('./FacialVerification'),
  PollingReport: require('./PollingReport'),
  BlockchainRecord: require('./BlockchainRecord'),
  Role: require('./Role'),
  UserAccount: require('./UserAccount'),
  AuditLog: require('./AuditLog'),
};
