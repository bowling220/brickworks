"use client";

import { useMemo } from "react";
import { BrickData, getWorldPositionFromGrid, getBrickFootprint } from "./GridSystem";
import { getWireframeBoxGeometry } from "./BrickGeometryCache";
import { getSelectionWireframeMaterial, getMoveOriginWireframeMaterial } from "./BrickMaterialCache";

interface SelectionOverlayRendererProps {
  selectedBricks: BrickData[];
  movingOriginBricks?: BrickData[];
}

export function SelectionOverlayRenderer({
  selectedBricks,
  movingOriginBricks = [],
}: SelectionOverlayRendererProps) {
  const selectionMat = useMemo(() => getSelectionWireframeMaterial(), []);
  const originMat = useMemo(() => getMoveOriginWireframeMaterial(), []);

  if (selectedBricks.length === 0 && movingOriginBricks.length === 0) {
    return null;
  }

  return (
    <group name="selection-overlays">
      {/* Selected Bricks Highlight Wireframes */}
      {selectedBricks.map((brick) => {
        const worldPos = getWorldPositionFromGrid(
          brick.gridX,
          brick.gridY,
          brick.gridZ,
          brick.rotation,
          brick.type
        );
        const { widthStuds, lengthStuds, heightUnits } = getBrickFootprint(
          brick.type,
          brick.rotation
        );
        const geo = getWireframeBoxGeometry(widthStuds, lengthStuds, heightUnits, 0.04);

        return (
          <mesh
            key={`sel-${brick.id}`}
            geometry={geo}
            material={selectionMat}
            position={worldPos}
            raycast={() => null} // Ignore raycasts on overlay
          />
        );
      })}

      {/* Moving Origin Faint Wireframe Markers */}
      {movingOriginBricks.map((brick) => {
        const worldPos = getWorldPositionFromGrid(
          brick.gridX,
          brick.gridY,
          brick.gridZ,
          brick.rotation,
          brick.type
        );
        const { widthStuds, lengthStuds, heightUnits } = getBrickFootprint(
          brick.type,
          brick.rotation
        );
        const geo = getWireframeBoxGeometry(widthStuds, lengthStuds, heightUnits, 0.02);

        return (
          <mesh
            key={`orig-${brick.id}`}
            geometry={geo}
            material={originMat}
            position={worldPos}
            raycast={() => null}
          />
        );
      })}
    </group>
  );
}
