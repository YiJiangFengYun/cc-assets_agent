import * as mapMK from "./map-mk";

// // 资源加载的处理回调
export type ProcessCallback = (completedCount: number, totalCount: number, item: any) => void;
// // 资源加载的完成回调
export type CompletedCallback = (error: Error, asset?: any) => void;

const mapNameAssetTypes: {[name: string]: typeof cc.Asset} = {};

interface ArgsUseAsset {
    keyUse: string;
    path: string,
    type: typeof cc.Asset,
    bundle: cc.AssetManager.Bundle,
    onCompleted?: CompletedCallback,
    onProgess?: ProcessCallback,
}

interface ArgsFreeAsset {
    keyUse: string,
    path: string,
    type: typeof cc.Asset,
    bundle: cc.AssetManager.Bundle,
}

// 兼容性处理
let isChildClassOf = cc.js["isChildClassOf"]
if (!isChildClassOf) {
    isChildClassOf = cc["isChildClassOf"];
}

//默认过期时间，单位秒
const DELAY_FREE_DEFAULT = 60;

export class AssetsAgent {
    /**
     * 外部使用信息
     * 外部通过唯一的id使用某些资源
     * {[唯一key]:{[bundle, 资源类型, 路径]: true }}
     */
    private _mapUses: { [key: string]: mapMK.MapMultiKeys<true> } = {};
    // private _mapUses: { [ key: string ]: [ string, typeof cc.Asset, cc.AssetManager.Bundle ][] } = {};

    private _loadingCount = 0;

    /**
     * 等待释放得资源
     * {[唯一key, bundle, 资源类型, 路径]: 释放时间}
     */
    private _waitFrees: mapMK.MapMultiKeys<number> = mapMK.createMapMultiKeys(4);

    /**
     * 标记是否已经被销毁了
     */
    private _isDestroyed: boolean = false;

    private _time = 0;

    private _intervalIndex: number = 0;

    private _delayFree = 0;

    public constructor(delayFree: number = DELAY_FREE_DEFAULT) {
        this._delayFree = delayFree;
        this._intervalIndex = setInterval(this._update.bind(this), 1000);
    }

    public del() {
        this._isDestroyed = true;
        clearInterval(this._intervalIndex);
        this._intervalIndex = 0;
        this._clear();
    }

    public init(delayFree: number = DELAY_FREE_DEFAULT) {
        this._delayFree = delayFree;
        this._clear();
    }

    public getUseInfo(id: string) {
        return this._mapUses[id];
    }

    /**
     * 使用资源
     * @param keyUse        标识使用的key
     * @param path           资源url
     * @param type          资源类型，默认为null
     * @param onProgess     加载进度回调
     * @param onCompleted   加载完成回调
     */
    public use(keyUse:  string, path: string, type: typeof cc.Asset);
    public use(keyUse:  string, path: string, type: typeof cc.Asset, onCompleted: CompletedCallback);
    public use(keyUse:  string, path: string, type: typeof cc.Asset, onProgess: ProcessCallback, onCompleted: CompletedCallback);
    public use(keyUse:  string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle);
    public use(keyUse:  string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle, onCompleted: CompletedCallback);
    public use(keyUse:  string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle, onProgess: ProcessCallback, onCompleted: CompletedCallback);
    public use() {
        if (this._isDestroyed) {
            return;
        }
        ++this._loadingCount;
        const args: ArgsUseAsset = this._makeArgsUse.apply(this, arguments);
        const mapUses = this._mapUses;
        const finishCallback = (error: Error, asset: cc.Asset) => {
            if (this._isDestroyed) {
                return;
            }
            --this._loadingCount;
            if (error) {
                if (args.onCompleted) args.onCompleted(error);
                return;
            }

            let assetUse = mapUses[args.keyUse];
            if (! assetUse) {
                mapUses[args.keyUse] = assetUse = mapMK.createMapMultiKeys(3);
            }

            // const pair: [ string, typeof cc.Asset ] = [ args.path, args.type ];

            if (! mapNameAssetTypes[(args.type as any).name]) mapNameAssetTypes[(args.type as any).name] = args.type;

            const notExists = ! assetUse.get([args.bundle.name, (args.type as any).name, args.path]);


            if (notExists) {

                asset.addRef();

                assetUse.set([args.bundle.name, (args.type as any).name, args.path], true);
            }

            // 执行完成回调
            if (args.onCompleted) {
                args.onCompleted(null, asset);
            }
        };

        //移除等待释放的资源
        this._removeWaitFree(args);

        // 预判是否资源已加载
        let asset = cc.resources.get(args.path, args.type);
        if (asset) {
            finishCallback(null, asset);
        } else {
            cc.resources.load(args.path, args.type, args.onProgess, finishCallback);
        }
    }

    /**
     * 释放资源
     * @param keyUse        标识使用的key
     * @param path          要释放的url
     * @param type          资源类型
     */
    public free(keyUse: string);
    public free(keyUse: string, path: string, type: typeof cc.Asset);
    public free(keyUse: string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle);
    public free() {
        if (this._isDestroyed) {
            return;
        }
        let args: ArgsFreeAsset = this._makeArgsFree.apply(this, arguments);
        if (arguments.length > 1) {
            this._addWaitFree(args);
        } else {
            const assetUse = this._mapUses[args.keyUse];
            assetUse && assetUse.forEach((value, keys) => {
                this._addWaitFree({
                    keyUse: args.keyUse,
                    bundle: cc.assetManager.getBundle(keys[0]),
                    type: mapNameAssetTypes[keys[1]],
                    path: keys[2],
                });
            });
        }
    }

    private _checkAndDoWaitFrees() {
        const waitFrees = this._waitFrees;
        const time = this._time;
        const doFrees: ArgsFreeAsset[] = [];
        waitFrees.forEach((expires, keys) => {
            if (expires <= time) {
                doFrees.push({
                    keyUse: keys[0],
                    bundle: cc.assetManager.getBundle(keys[1]),
                    type: mapNameAssetTypes[keys[2]],
                    path: keys[3],
                });
            }
        });

        doFrees.forEach((item) => {
            this._doFree(item.keyUse, item.path, item.type, item.bundle);
        });
    }

    private _doFree(keyUse: string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle) {
        const mapUses = this._mapUses;
        const assetUse = mapUses[keyUse];
        assetUse.delete([bundle.name, (type as any).name, path]);
        bundle.get(path, type).decRef();
    }

    private _addWaitFree(args: ArgsFreeAsset) {
        this._waitFrees.set([args.keyUse, args.bundle.name, (args.type as any).name, args.path], this._time + this._delayFree);
    }

    private _removeWaitFree(args: ArgsUseAsset) {
        this._waitFrees.delete([args.keyUse, args.bundle.name, (args.type as any).name, args.path]);
    }

    private _update() {
        ++this._time;
        if (this._loadingCount <= 0) {
            this._checkAndDoWaitFrees();
        }
    }

    private _clear() {
        this._loadingCount = 0;
        const mapUses = this._mapUses;
        for (let key in mapUses) {
            const assetUse = mapUses[key];
            assetUse && assetUse.forEach((_, keys) => {
                const asset = cc.assetManager.getBundle(keys[0]).get(keys[2], mapNameAssetTypes[keys[1]]);
                asset.decRef();
            });
        }
        this._mapUses = {};
        this._waitFrees.clear();
        this._time = 0;
    }

    /**
     * 使用资源处理参数
     */
     private _makeArgsUse(): ArgsUseAsset {
        if (arguments.length < 3 || 
            typeof arguments[0] !== "string" || 
            typeof arguments[1] !== "string") {
           throw new Error(`Arguments is invalid !`);
        }
        let ret: ArgsUseAsset = { 
            keyUse: arguments[0], 
            path: arguments[1], 
            type: arguments[2],
            bundle: arguments[3] || cc.resources,
        };
        for (let i = 2; i < arguments.length; ++i) {
            if (i == 2 && isChildClassOf(arguments[i], cc.Asset)) {
                ret.type = arguments[i];
            } else if (i == 3 && isChildClassOf(arguments[i], cc.AssetManager.Bundle)) {
                ret.bundle = arguments[i];
            }else if (typeof arguments[i] == "function") {
                // 其他情况为函数
                if (arguments.length > i + 1 && typeof arguments[i + 1] == "function") {
                    ret.onProgess = arguments[i];
                } else {
                    ret.onCompleted = arguments[i];
                }
            }
        }
        return ret;
    }

    /**
     * 释放资源处理参数
     */
    private _makeArgsFree(): ArgsFreeAsset {
        if (arguments.length < 1 || typeof arguments[0] != "string") {
            throw new Error(`Arguments is invalid !`);
        }
        let ret: ArgsFreeAsset = { 
            keyUse: arguments[0], 
            path: arguments[1],
            type: arguments[2],
            bundle: arguments[3] || cc.resources,
        };
        return ret;
    }
}

export const assetsAgent = new AssetsAgent();
if (window) (window as any).assetsAgent = assetsAgent;