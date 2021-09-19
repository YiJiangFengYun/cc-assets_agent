export declare type MapMultiKeys<T> = {
    map: any;
    get(keys: string[]): T;
    set(keys: string[], value: T): void;
    clear(): void;
    delete(keys: string[]): void;
    forEach(fun: (value: any, keys: string[]) => void): void;
};
export declare function createMapMultiKeys<T>(keyCount: number): MapMultiKeys<T>;
