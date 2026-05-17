// frontend/src/components/settings/shared/BaseTreeFlow.tsx

import { Background, Controls, ReactFlow, useReactFlow } from "reactflow";

import "reactflow/dist/style.css";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";

import type { Node } from "reactflow";

import { buildTreeElements, getLayoutedElements } from "./treeLayout";

type TreeItem<T = any> = {
  id: number;

  name: string;

  children?: T[];

  stats?: {
    total_books?: number;

    read_books?: number;

    unread_books?: number;
  };
};

type Props<T extends TreeItem<T>> = {
  items: T[];

  focusedId: number | null;

  focusedPath: number[];

  searchTargetId: string | null;

  nodeType: string;

  nodeComponent: ComponentType<any>;

  onFocus: (id: number) => void;

  onRename: (id: number, name: string) => Promise<void>;

  onAddChild: (parentId: number, name: string) => Promise<void>;

  onDelete: (id: number, cascade?: boolean) => Promise<any>;
};

// ================= VIEWPORT =================

function ViewportController({
  searchTargetId,
  focusedPath,
}: {
  searchTargetId: string | null;

  focusedPath: number[];
}) {
  const { fitView } = useReactFlow();

  const previousSearchRef = useRef<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // ================= SEARCH =================

      if (searchTargetId) {
        previousSearchRef.current = searchTargetId;

        fitView({
          nodes: [
            {
              id: searchTargetId,
            },
          ],

          duration: 700,

          padding: 0.7,
        });

        return;
      }

      // ================= SEARCH CLEARED =================

      if (previousSearchRef.current && !searchTargetId) {
        previousSearchRef.current = null;
      }

      // ================= FOCUS =================

      if (focusedPath.length > 0) {
        fitView({
          duration: 700,

          padding: 0.35,
        });

        return;
      }

      // ================= OVERVIEW =================

      fitView({
        duration: 700,

        padding: 0.2,
      });
    }, 120);

    return () => clearTimeout(timeout);
  }, [searchTargetId, focusedPath, fitView]);

  return null;
}

// ================= COMPONENT =================

export function BaseTreeFlow<T extends TreeItem<T>>({
  items,

  focusedId,

  focusedPath,

  searchTargetId,

  nodeType,

  nodeComponent,

  onFocus,

  onRename,

  onAddChild,

  onDelete,
}: Props<T>) {
  const nodeTypes = useMemo(
    () => ({
      [nodeType]: nodeComponent,
    }),
    [nodeType, nodeComponent],
  );

  const layouted = useMemo(() => {
    const tree = buildTreeElements(
      items,

      focusedPath,

      focusedId,

      onFocus,

      onRename,

      onAddChild,

      onDelete,

      nodeType,
    );

    return getLayoutedElements(tree.nodes, tree.edges);
  }, [
    items,

    focusedId,

    focusedPath,

    onFocus,

    onRename,

    onAddChild,

    onDelete,

    nodeType,
  ]);

  // ================= ANIMATED NODES =================

  const [animatedNodes, setAnimatedNodes] = useState<Node[]>(
    layouted.nodes as Node[],
  );

  useEffect(() => {
    setAnimatedNodes((prev) => {
      const previousNodeMap = new Map(
        prev.map((node: Node) => [node.id, node]),
      );

      return layouted.nodes.map((newNode: Node) => {
        const existing = previousNodeMap.get(newNode.id);

        return {
          ...newNode,

          position: existing?.position || newNode.position,

          style: {
            ...newNode.style,

            transition: "all 300ms ease",
          },
        };
      });
    });

    requestAnimationFrame(() => {
      setAnimatedNodes(
        layouted.nodes.map((node: Node) => ({
          ...node,

          style: {
            ...node.style,

            transition: "all 300ms ease",
          },
        })),
      );
    });
  }, [layouted.nodes]);

  return (
    <div
      className="
        hidden lg:block flex-1

        relative

        overflow-hidden
      "
    >
      {/* AMBIENT BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* PURPLE GLOW */}
        <div
          className="
            absolute

            w-[900px]
            h-[900px]

            rounded-full

            bg-fuchsia-500/10

            blur-3xl

            -top-[350px]
            -left-[250px]

            animate-[pulse_18s_ease-in-out_infinite]
          "
        />

        {/* BLUE GLOW */}
        <div
          className="
            absolute

            w-[800px]
            h-[800px]

            rounded-full

            bg-blue-500/10

            blur-3xl

            bottom-[-300px]
            right-[-200px]

            animate-[pulse_24s_ease-in-out_infinite]
          "
        />

        {/* EMERALD GLOW */}
        <div
          className="
            absolute

            w-[700px]
            h-[700px]

            rounded-full

            bg-emerald-500/6

            blur-3xl

            top-[30%]
            left-[40%]

            animate-[pulse_30s_ease-in-out_infinite]
          "
        />
      </div>

      <ReactFlow
        nodes={animatedNodes}
        edges={layouted.edges}
        nodeTypes={nodeTypes}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        nodesFocusable={false}
        onPaneClick={() => onFocus(-1)}
        proOptions={{
          hideAttribution: true,
        }}
      >
        <ViewportController
          searchTargetId={searchTargetId}
          focusedPath={focusedPath}
        />

        <Controls
          className="
            bg-gray-900/80

            border border-gray-700

            rounded-xl

            overflow-hidden
          "
        />

        <Background gap={32} size={1} color="rgba(255,255,255,0.035)" />
      </ReactFlow>
    </div>
  );
}
