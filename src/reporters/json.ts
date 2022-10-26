import path from 'node:path';
import { isFile } from '../util/fs.js';
import { relative } from '../util/path.js';
import { OwnershipEngine } from '@snyk/github-codeowners/dist/lib/ownership/index.js';
import type { Entries } from 'type-fest';
import type { Report, ReporterOptions, IssueSet, IssueRecords, SymbolIssueType, Issue } from '../types.js';

type ExtraReporterOptions = {
  codeowners?: string;
};

type Row = {
  file: string;
  owners: string[];
  files?: boolean;
  dependencies?: string[];
  devDependencies?: string[];
  unlisted?: string[];
  exports?: string[];
  types?: string[];
  duplicates?: string[][];
  enumMembers?: Record<string, string[]>;
  classMembers?: Record<string, string[]>;
};

const mergeTypes = (type: SymbolIssueType) =>
  type === 'exports' || type === 'nsExports' ? 'exports' : type === 'types' || type === 'nsTypes' ? 'types' : type;

export default async ({ report, issues, options }: ReporterOptions) => {
  let opts: ExtraReporterOptions = {};
  try {
    opts = options ? JSON.parse(options) : opts;
  } catch (error) {
    console.error(error);
  }

  const json: Record<string, Row> = {};
  const codeownersFilePath = path.resolve(opts.codeowners ?? '.github/CODEOWNERS');
  const codeownersEngine = (await isFile(codeownersFilePath)) && OwnershipEngine.FromCodeownersFile(codeownersFilePath);

  const flatten = (issues: IssueRecords): Issue[] => Object.values(issues).map(Object.values).flat();

  const initRow = (filePath: string) => {
    const file = relative(filePath);
    const row: Row = {
      file,
      ...(codeownersEngine && { owners: codeownersEngine.calcFileOwnership(file) }),
      ...(report.files && { files: false }),
      ...(report.dependencies && { dependencies: [] }),
      ...(report.devDependencies && { devDependencies: [] }),
      ...(report.unlisted && { unlisted: [] }),
      ...((report.exports || report.nsExports) && { exports: [] }),
      ...((report.types || report.nsTypes) && { types: [] }),
      ...(report.enumMembers && { enumMembers: {} }),
      ...(report.classMembers && { classMembers: {} }),
      ...(report.duplicates && { duplicates: [] }),
    };
    return row;
  };

  for (const [reportType, isReportType] of Object.entries(report) as Entries<Report>) {
    if (isReportType) {
      if (reportType === 'files') {
        Array.from(issues[reportType] as IssueSet).forEach(filePath => {
          json[filePath] = json[filePath] ?? initRow(filePath);
          json[filePath][reportType] = true;
        });
      } else {
        const type = mergeTypes(reportType);
        flatten(issues[reportType] as IssueRecords).forEach(issue => {
          const { filePath, symbol, symbols, parentSymbol } = issue;
          json[filePath] = json[filePath] ?? initRow(filePath);
          if (type === 'duplicates') {
            symbols && json[filePath][type]?.push(symbols);
          } else if (type === 'enumMembers' || type === 'classMembers') {
            if (parentSymbol) {
              json[filePath][type]![parentSymbol] = json[filePath][type]![parentSymbol] ?? [];
              json[filePath][type]![parentSymbol].push(symbol);
            }
          } else {
            json[filePath][type]?.push(symbol);
          }
        });
      }
    }
  }

  console.log(JSON.stringify(Object.values(json)));
};
