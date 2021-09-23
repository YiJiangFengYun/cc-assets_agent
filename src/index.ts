// // 资源加载的处理回调
export type ProcessCallback = (completedCount: number, totalCount: number, item: any) => void;
// // 资源加载的完成回调
export type CompletedCallback = (error: Error, asset?: any) => void;

const mapNameAssetTypes: {[name: string]: TypeInfo} = {};

export type TypeInfo = { name: string, type: typeof cc.Asset };

interface ArgsUseAsset {
    keyUse: string;
    path: string,
    type: TypeInfo,
    bundle: cc.AssetManager.Bundle,
    onCompleted?: CompletedCallback,
    onProgess?: ProcessCallback,
}

interface ArgsFreeAsset {
    keyUse: string,
    path: string,
    type: TypeInfo,
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

    private _mapTypeInfos: Map<typeof cc.Asset, TypeInfo> = new Map();
    private _mapNameTypeInfos: { [name: string]: TypeInfo } = {};

    /**
     * 外部使用信息
     * 外部通过唯一的id使用某些资源
     * {[唯一key]:{["bundle 资源类型 路径"]: true }}
     */
    private _mapUses: { [key: string]: {[str: string]:true} } = {};
    // private _mapUses: { [ key: string ]: [ string, typeof cc.Asset, cc.AssetManager.Bundle ][] } = {};

    private _loadingCount = 0;

    /**
     * 等待释放得资源
     * {["唯一key bundle 资源类型 路径"]: 释放时间}
     */
    private _waitFrees: {[str: string]: number} = {};

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

        const typeInfosBuildIn: TypeInfo[] = [
            {
                name: "text",
                type: cc.TextAsset,
            },
            {
                name: "buffer",
                type: cc.BufferAsset,
            },
            {
                name: "texture_2d",
                type: cc.Texture2D,
            },
            {
                name: "sprite_frame",
                type: cc.SpriteFrame,
            },
            {
                name: "mesh",
                type: cc.Mesh,
            },
            {
                name: "effect",
                type: cc.EffectAsset,
            },
            {
                name: "material",
                type: cc.Material,
            },
            {
                name: "physics_material",
                type: cc.PhysicsMaterial,
            },
            {
                name: "animation_clip",
                type: cc.AnimationClip,
            },
            {
                name: "audio_clip",
                type: cc.AudioClip,
            },
            {
                name: "prefab",
                type: cc.Prefab,
            },
            {
                name: "scene",
                type: cc.SceneAsset,
            },
            {
                name: "font",
                type: cc.Font,
            },
            {
                name: "bitmap_font",
                type: cc.BitmapFont,
            },
            {
                name: "json",
                type: cc.JsonAsset,
            },
            {
                name: "particle_asset",
                type: cc.ParticleAsset,
            },
            {
                name: "tiled_map_asset",
                type: cc.TiledMapAsset,
            }
        ];

        const mapTypeInfos = this._mapTypeInfos;
        const mapNameTypeInfos = this._mapNameTypeInfos;

        typeInfosBuildIn.forEach((item) => {
            mapTypeInfos.set(item.type, item);
            mapNameTypeInfos[item.name] = item;
        });
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

    public registerTypeInfo(name: string, type: typeof cc.Asset) {
        if (this._mapTypeInfos.get(type)) throw new Error(`The type has been registered!`);
        if (this._mapNameTypeInfos[name]) throw new Error(`The type name (${name}) has been registered !`);
        const typeInfo = { name, type };
        this._mapTypeInfos.set(type, typeInfo);
        this._mapNameTypeInfos[name] = typeInfo;
    }

    public getTypeInfo(type: typeof cc.Asset) { return this._mapTypeInfos.get(type); }

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
                mapUses[args.keyUse] = assetUse = {};
            }

            // const pair: [ string, typeof cc.Asset ] = [ args.path, args.type ];

            if (! mapNameAssetTypes[args.type.name]) mapNameAssetTypes[args.type.name] = args.type;

            const notExists = ! assetUse[`${args.bundle.name} ${args.type.name} ${args.path}`];


            if (notExists) {

                asset.addRef();

                assetUse[`${args.bundle.name} ${args.type.name} ${args.path}`] = true;
            }

            // 执行完成回调
            if (args.onCompleted) {
                args.onCompleted(null, asset);
            }
        };

        //移除等待释放的资源
        this._removeWaitFree(args);

        // 预判是否资源已加载
        let asset = args.bundle.get(args.path, args.type.type);
        if (asset) {
            finishCallback(null, asset);
        } else {
            args.bundle.load(args.path, args.type.type, args.onProgess, finishCallback);
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
            if (assetUse) {
                for (let key in assetUse) {
                    const keys = key.split(" ");
                    this._addWaitFree({
                        keyUse: args.keyUse,
                        bundle: cc.assetManager.getBundle(keys[0]),
                        type: mapNameAssetTypes[keys[1]],
                        path: keys[2],
                    });
                }
            }
        }
    }

    private _checkAndDoWaitFrees() {
        const waitFrees = this._waitFrees;
        const time = this._time;
        const doFrees: ArgsFreeAsset[] = [];
        for (let str in waitFrees) {
            const keys = str.split(" ");
            const expires = waitFrees[str];
            if (expires <= time) {
                doFrees.push({
                    keyUse: keys[0],
                    bundle: cc.assetManager.getBundle(keys[1]),
                    type: mapNameAssetTypes[keys[2]],
                    path: keys[3],
                });
            }
        }

        doFrees.forEach((item) => {
            delete waitFrees[`${item.keyUse} ${item.bundle.name} ${item.type.name} ${item.path}`];
            this._doFree(item.keyUse, item.path, item.type, item.bundle);
        });
    }

    private _doFree(keyUse: string, path: string, type: TypeInfo, bundle: cc.AssetManager.Bundle) {
        const mapUses = this._mapUses;
        const assetUse = mapUses[keyUse];
        delete assetUse[`${bundle.name} ${type.name} ${path}`];
        bundle.get(path, type.type).decRef();
        if ( ! Object.keys(assetUse).length) {
            delete mapUses[keyUse];
        }
    }

    private _addWaitFree(args: ArgsFreeAsset) {
        this._waitFrees[`${args.keyUse} ${args.bundle.name} ${args.type.name} ${args.path}`] = this._time + this._delayFree;
    }

    private _removeWaitFree(args: ArgsUseAsset) {
        delete this._waitFrees[`${args.keyUse} ${args.bundle.name} ${args.type.name} ${args.path}`];
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
            if (assetUse) {
                for (let str in assetUse) {
                    const keys = str.split(" ");
                    const asset = cc.assetManager.getBundle(keys[0]).get(keys[2], mapNameAssetTypes[keys[1]].type);
                    asset.decRef();
                }
            }
        }
        this._mapUses = {};
        this._waitFrees = {};
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

        const type: typeof cc.Asset = arguments[2];
        const typeInfo = this._mapTypeInfos.get(type);
        if (! typeInfo) throw new Error(`Invalid cc asset type!`);

        let ret: ArgsUseAsset = { 
            keyUse: arguments[0].trim(), 
            path: arguments[1].trim(), 
            type: typeInfo,
            bundle: cc.resources,
        };
        for (let i = 3; i < arguments.length; ++i) {
            if (i == 3 && typeof arguments[i] !== "function") {
                ret.bundle = arguments[i] || cc.resources;
            } else if (typeof arguments[i] == "function") {
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

        var typeInfo: TypeInfo;
        if (arguments[2]) {
            const type: typeof cc.Asset = arguments[2];
            typeInfo = this._mapTypeInfos.get(type);
            if (! typeInfo) throw new Error(`Invalid cc asset type!`);
        }

        let ret: ArgsFreeAsset = { 
            keyUse: arguments[0].trim(), 
            path: typeof arguments[1] === "string" ? arguments[1].trim() : arguments[1],
            type: typeInfo,
            bundle: arguments[3] || cc.resources,
        };
        return ret;
    }
}

export const assetsAgent = new AssetsAgent();
if (window) (window as any).assetsAgent = assetsAgent;