declare module 'react-katex' {
    import * as React from 'react';

    interface KaTeXProps {
        math: string;
        block?: boolean;
        errorColor?: string;
        renderError?: (error: any) => React.ReactNode;
        settings?: any;
    }

    export const InlineMath: React.FC<KaTeXProps>;
    export const BlockMath: React.FC<KaTeXProps>;
}