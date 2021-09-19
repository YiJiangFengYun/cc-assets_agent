
export function createMapMultiKeys(keyCount: number) {
    const _map = new Map();

    function _checkKeysEqualKeyCount(keys: any[]) {
        if (keys && keys.length === keyCount) return true;
        console.error(`Multiple keys map: keys length is not equal to key count!`);
        return false;
    }

    function _checkKeysLessKeyCount(keys: any[]) {
        if (keys && keys.length < keyCount) return true;
        console.error(`Multiple keys map: keys length is not less than key count!`);
        return false;
    }

    return {
        get(keys: any[]): any {
            if (_checkKeysEqualKeyCount(keys)) {
                var value = _map;
                for (let key of keys) {
                    value = value.get(key);
                    if (! value) return value as any;
                }
                return value as any;
            }
        },

        set(keys: any[], value: any) {
            if (_checkKeysEqualKeyCount(keys)) {
                var map = _map;
                const keyCount = keys.length;
                const keyCountDecOne = keyCount - 1;
                var i = 0;
                while (i < keyCountDecOne) {
                    let map2 = map.get(keys[i]);
                    if ( ! map2) {
                        map2 = new Map();
                        map.set(keys[i], map2);
                    }
                    map = map2;
                    ++i;
                }
                map.set(keys[i], value);
            }
        },

        clear() {
            _map.clear();
        },

        delete(keys: any[]) {
            if (_checkKeysLessKeyCount(keys)) {
                const maps: Map<any, any>[] = [];
                const countMap = maps.length = keyCount;
                const keyCountDecOne = keyCount - 1;
                const keyLength = keys.length;
                let index = 0;
                let value = _map;
                while (index < countMap && value) {
                    maps[index] = value;
                    if (index < keyCountDecOne && index < keyLength) 
                        value = value.get(keys[index]);
                    ++index;
                }

                for (let i = keyCountDecOne; i >= 0; --i) {
                    if (maps[i] && i < keyLength) {
                        if (i === keyCountDecOne) {
                            maps[i].delete(keys[i]);
                        } else if ( (! maps[i + 1].size) || (i + 1 === keyLength)) {
                            //当提删除得目标map为空或者缺少对于应得key意味着不管是为空也要删除
                            maps[i].delete(keys[i]);
                        }
                    }
                }
            }
        },

        forEach(fun: (value: any, keys: any[]) => void) {
            forEachMap(_map, []);
            function forEachMap(map: Map<any, any>, lastKeys: any[]) {
                map.forEach((value, key) => {
                    lastKeys = lastKeys.concat(key);
                    if (lastKeys.length < keyCount) {
                        forEachMap(value, lastKeys);
                    } else {
                        fun(value, lastKeys);
                    }
                })
            }
        }


    }
}

export type MapMultiKeys = ReturnType<typeof createMapMultiKeys>;