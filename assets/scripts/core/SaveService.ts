import { sys } from 'cc';

import { DEFAULT_SAVE_MODEL, SaveModel } from '../model/common/SaveModel';

const STORAGE_KEY = 'make24.save';

export class SaveService {
    public load(): SaveModel {
        const rawValue = sys.localStorage.getItem(STORAGE_KEY);

        if (!rawValue) {
            return DEFAULT_SAVE_MODEL;
        }

        try {
            return JSON.parse(rawValue) as SaveModel;
        } catch {
            return DEFAULT_SAVE_MODEL;
        }
    }

    public save(data: SaveModel): void {
        sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}
