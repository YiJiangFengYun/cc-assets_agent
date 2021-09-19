import * as mapMK from "./map-mk";
export declare type ProcessCallback = (completedCount: number, totalCount: number, item: any) => void;
export declare type CompletedCallback = (error: Error, asset?: any) => void;
export declare class AssetsAgent {
    /**
     * 外部使用信息
     * 外部通过唯一的id使用某些资源
     * {[唯一key]:{[bundle, 资源类型, 路径]: true }}
     */
    private _mapUses;
    private _loadingCount;
    /**
     * 等待释放得资源
     * {[唯一key, bundle, 资源类型, 路径]: 释放时间}
     */
    private _waitFrees;
    /**
     * 标记是否已经被销毁了
     */
    private _isDestroyed;
    private _time;
    private _intervalIndex;
    private _delayFree;
    constructor(delayFree?: number);
    del(): void;
    init(delayFree?: number): void;
    getUseInfo(id: string): mapMK.MapMultiKeys<true>;
    /**
     * 使用资源
     * @param keyUse        标识使用的key
     * @param path           资源url
     * @param type          资源类型，默认为null
     * @param onProgess     加载进度回调
     * @param onCompleted   加载完成回调
     */
    use(keyUse: string, path: string, type: typeof cc.Asset): any;
    use(keyUse: string, path: string, type: typeof cc.Asset, onCompleted: CompletedCallback): any;
    use(keyUse: string, path: string, type: typeof cc.Asset, onProgess: ProcessCallback, onCompleted: CompletedCallback): any;
    use(keyUse: string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle): any;
    use(keyUse: string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle, onCompleted: CompletedCallback): any;
    use(keyUse: string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle, onProgess: ProcessCallback, onCompleted: CompletedCallback): any;
    /**
     * 释放资源
     * @param keyUse        标识使用的key
     * @param path          要释放的url
     * @param type          资源类型
     */
    free(keyUse: string): any;
    free(keyUse: string, path: string, type: typeof cc.Asset): any;
    free(keyUse: string, path: string, type: typeof cc.Asset, bundle: cc.AssetManager.Bundle): any;
    private _checkAndDoWaitFrees;
    private _doFree;
    private _addWaitFree;
    private _removeWaitFree;
    private _update;
    private _clear;
    /**
     * 使用资源处理参数
     */
    private _makeArgsUse;
    /**
     * 释放资源处理参数
     */
    private _makeArgsFree;
}
export declare const assetsAgent: AssetsAgent;
