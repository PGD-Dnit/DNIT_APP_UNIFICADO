// src/core/ErrorBoundary.tsx
import React from "react";

type Props = { children: React.ReactNode };
type State = { error: any };

export default class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: any) {
        return { error };
    }

    componentDidCatch(error: any, info: any) {
        console.error("UI ErrorBoundary:", error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Erro no painel</div>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.9 }}>
                        {String(this.state.error?.message || this.state.error)}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}
