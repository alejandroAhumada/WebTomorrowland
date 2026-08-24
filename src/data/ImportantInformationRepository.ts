import type { ImportantInformation } from '../models/importantInformation'

export interface ImportantInformationRepository { getAll(): Promise<ImportantInformation[]> }
