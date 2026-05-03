import { Background, Controls, ReactFlow, useReactFlow } from "reactflow";

import "reactflow/dist/style.css";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Category } from "../../../types/category";

import { CategoryTreeNode } from "./CategoryTreeNode";

import { buildTreeElements, getLayoutedElements } from "./treeLayout";

type Props = {
  categories: Category[];

  focusedId: number | null;

  focusedPath: number[];

  searchTargetId: string | null;

  onFocus: (id: number) => void;

  onRename: (id: number, name: string) => Promise<void>;

  onAddChild: (parentId: number, name: string) => Promise<void>;

  onDelete: (id: number, cascade?: boolean) => Promise<any>;
};

const nodeTypes = {
  categoryNode: CategoryTreeNode,
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

  // ================= SEARCH =================

  useEffect(() => {
    if (searchTargetId) {
      previousSearchRef.current = searchTargetId;

      setTimeout(() => {
        fitView({
          nodes: [
            {
              id: searchTargetId,
            },
          ],

          duration: 700,

          padding: 0.7,
        });
      }, 120);

      return;
    }

    // ================= SEARCH CLEARED =================

    if (previousSearchRef.current && !searchTargetId) {
      previousSearchRef.current = null;

      if (focusedPath.length > 0) {
        setTimeout(() => {
          fitView({
            nodes: focusedPath.map((id) => ({
              id: String(id),
            })),

            duration: 700,

            padding: 0.9,
          });
        }, 120);

        return;
      }

      setTimeout(() => {
        fitView({
          duration: 700,

          padding: 0.2,
        });
      }, 120);
    }
  }, [searchTargetId, focusedPath, fitView]);

  // ================= FOCUS =================

  useEffect(() => {
    if (focusedPath.length === 0) return;

    if (searchTargetId) return;

    setTimeout(() => {
      fitView({
        nodes: focusedPath.map((id) => ({
          id: String(id),
        })),

        duration: 700,

        padding: 0.9,
      });
    }, 120);
  }, [focusedPath, searchTargetId, fitView]);

  // ================= OVERVIEW =================

  useEffect(() => {
    if (focusedPath.length > 0) return;

    if (searchTargetId) return;

    setTimeout(() => {
      fitView({
        duration: 700,

        padding: 0.2,
      });
    }, 120);
  }, [focusedPath, searchTargetId, fitView]);

  return null;
}

// ================= COMPONENT =================

export function CategoryTreeFlow({
  categories,

  focusedId,

  focusedPath,

  searchTargetId,

  onFocus,

  onRename,

  onAddChild,

  onDelete,
}: Props) {
  const layouted = useMemo(() => {
    const tree = buildTreeElements(
      categories,

      focusedPath,

      focusedId,

      onFocus,

      onRename,

      onAddChild,

      onDelete,
    );

    return getLayoutedElements(tree.nodes, tree.edges);
  }, [
    categories,

    focusedId,

    focusedPath,

    onFocus,

    onRename,

    onAddChild,

    onDelete,
  ]);

  // ================= ANIMATED NODES =================

  const [animatedNodes, setAnimatedNodes] = useState(layouted.nodes);

  useEffect(() => {
    setAnimatedNodes((prev) =>
      layouted.nodes.map((newNode) => {
        const existing = prev.find((n) => n.id === newNode.id);

        return {
          ...newNode,

          position: existing?.position || newNode.position,

          style: {
            ...newNode.style,

            transition: "all 300ms ease",
          },
        };
      }),
    );

    requestAnimationFrame(() => {
      setAnimatedNodes(
        layouted.nodes.map((node) => ({
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
    <div className="hidden lg:block flex-1">
      <ReactFlow
        nodes={animatedNodes}
        edges={layouted.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
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

        <Background gap={28} size={1} color="rgba(255,255,255,0.06)" />
      </ReactFlow>
    </div>
  );
}
