interface DocumentDictionary { [id: string]: any };
export interface AfterCommitHistory {
  read: DocumentDictionary;
  create: DocumentDictionary;
  update: DocumentDictionary;
  delete: DocumentDictionary;
}
