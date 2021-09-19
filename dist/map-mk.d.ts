export declare function createMapMultiKeys(keyCount: number): {
    get(keys: any[]): any;
    set(keys: any[], value: any): void;
    clear(): void;
    delete(keys: any[]): void;
    forEach(fun: (value: any, keys: any[]) => void): void;
};
export declare type MapMultiKeys = ReturnType<typeof createMapMultiKeys>;
