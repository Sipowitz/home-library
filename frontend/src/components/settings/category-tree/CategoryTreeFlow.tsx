import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Node,
} from "reactflow";

import "reactflow/dist/style.css";

import { useEffect, useMemo, useRef } from "react";

import type { Category } from "../../../types/category";

import { CategoryTreeNode } from "./CategoryTreeNode";

import { buildTree, getLayoutedElements } from "./categoryTreeUtils";

type Props = {
  categories: Category[];
  focusedId: number | null;
  focusedPath: number[];
  searchTargetId: string | null;
  onFocus: (id: number) => void;
};

const nodeTypes = {
  categoryNode: CategoryTreeNode,
};

// ================= VIEWPORT CONTROLLER =================

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
}: Props) {
  const flow = useMemo(() => {
    const tree = buildTree(categories, focusedPath, focusedId, onFocus);

    return getLayoutedElements(tree.nodes, tree.edges);
  }, [categories, focusedId, focusedPath, onFocus]);

  return (
    <div className="hidden lg:block flex-1 bg-transparent">
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        fitView
        style={{
          background: "transparent",
        }}
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
            bg-gray-900/70
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
