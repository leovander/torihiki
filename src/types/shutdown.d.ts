export type ShutDownCallback = {
    name: string;
    callback: () => void;
    isAsync: boolean;
};
