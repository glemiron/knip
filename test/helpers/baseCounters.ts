import { ISSUE_TYPES } from '../../src/constants';
import type { IssueType } from '../../src/types/issues';

const baseCounters = {
  ...(Object.fromEntries(ISSUE_TYPES.map(issueType => [issueType, 0])) as Record<IssueType, number>),
  processed: 0,
  total: 0,
};

export default baseCounters;
