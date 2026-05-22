using System.Collections.Generic;
using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    public sealed class RoadDebugOverlay : MonoBehaviour
    {
        private static readonly float[] DefaultDepths = { 1f, 0.75f, 0.5f, 0.25f, 0f };

        public Pseudo3DRoadRenderer roadRenderer;
        public bool showGuides = true;
        public Vector2 carAnchorViewport = new Vector2(RoadViewportContract.CarAnchorX, RoadViewportContract.CarAnchorY);

        [Range(0f, 1f)]
        public float hudSafeTopViewportY = RoadViewportContract.HudSafeTopY;

        [Range(0f, 0.8f)]
        public float spawnLaneOffset = 0.28f;

        public Color horizonColor = new Color(0.2f, 0.8f, 1f, 0.9f);
        public Color roadBoundsColor = new Color(1f, 0.82f, 0.18f, 0.9f);
        public Color carAnchorColor = new Color(0.2f, 1f, 0.42f, 0.95f);
        public Color spawnPointColor = new Color(1f, 0.32f, 0.32f, 0.88f);
        public Color hudSafeColor = new Color(0.75f, 0.55f, 1f, 0.75f);

        private readonly List<LineRenderer> lines = new List<LineRenderer>();
        private Material lineMaterial;

        private void Awake()
        {
            EnsureMaterial();
        }

        private void OnEnable()
        {
            EnsureMaterial();
        }

        private void OnValidate()
        {
            EnsureMaterial();
        }

        private void LateUpdate()
        {
            RebuildGuides();
        }

        public void RebuildGuides()
        {
            if (roadRenderer == null)
            {
                SetLineCount(0);
                return;
            }

            if (!showGuides)
            {
                SetLinesEnabled(false);
                return;
            }

            EnsureMaterial();
            SetLinesEnabled(true);

            int cursor = 0;
            RoadProjectionSample horizon = roadRenderer.Sample(1f);
            cursor = SetLine(cursor, "Horizon", horizonColor, new[]
            {
                roadRenderer.ViewportToLocal(new Vector2(0f, horizon.ViewportY), -0.22f),
                roadRenderer.ViewportToLocal(new Vector2(1f, horizon.ViewportY), -0.22f)
            }, 0.018f);

            foreach (float depth in DefaultDepths)
            {
                RoadProjectionSample sample = roadRenderer.Sample(depth);
                cursor = SetLine(cursor, "RoadBounds_" + depth.ToString("0.00"), roadBoundsColor, new[]
                {
                    sample.PointAt(-1f, -0.22f),
                    sample.PointAt(1f, -0.22f)
                }, 0.014f);

                cursor = AddCross(cursor, "CenterDepth_" + depth.ToString("0.00"), roadBoundsColor, sample.PointAt(0f, -0.22f), 0.05f);
                cursor = AddCross(cursor, "SpawnLeft_" + depth.ToString("0.00"), spawnPointColor, sample.PointAt(-(1f + spawnLaneOffset), -0.22f), 0.045f);
                cursor = AddCross(cursor, "SpawnRight_" + depth.ToString("0.00"), spawnPointColor, sample.PointAt(1f + spawnLaneOffset, -0.22f), 0.045f);
            }

            Vector3 carAnchor = roadRenderer.ViewportToLocal(carAnchorViewport, -0.22f);
            cursor = AddCross(cursor, "CarAnchor", carAnchorColor, carAnchor, 0.13f);

            Vector3 hudTopLeft = roadRenderer.ViewportToLocal(new Vector2(0f, hudSafeTopViewportY), -0.22f);
            Vector3 hudTopRight = roadRenderer.ViewportToLocal(new Vector2(1f, hudSafeTopViewportY), -0.22f);
            Vector3 hudFrameTopLeft = roadRenderer.ViewportToLocal(new Vector2(0f, 1f), -0.22f);
            Vector3 hudFrameTopRight = roadRenderer.ViewportToLocal(new Vector2(1f, 1f), -0.22f);
            cursor = SetLine(cursor, "HudSafeBottom", hudSafeColor, new[] { hudTopLeft, hudTopRight }, 0.016f);
            cursor = SetLine(cursor, "HudSafeLeft", hudSafeColor, new[] { hudTopLeft, hudFrameTopLeft }, 0.012f);
            cursor = SetLine(cursor, "HudSafeRight", hudSafeColor, new[] { hudTopRight, hudFrameTopRight }, 0.012f);
            cursor = SetLine(cursor, "HudSafeTop", hudSafeColor, new[] { hudFrameTopLeft, hudFrameTopRight }, 0.012f);

            SetLineCount(cursor);
        }

        private int AddCross(int cursor, string name, Color color, Vector3 center, float radius)
        {
            cursor = SetLine(cursor, name + "_Horizontal", color, new[]
            {
                center + new Vector3(-radius, 0f, 0f),
                center + new Vector3(radius, 0f, 0f)
            }, 0.012f);

            return SetLine(cursor, name + "_Vertical", color, new[]
            {
                center + new Vector3(0f, -radius, 0f),
                center + new Vector3(0f, radius, 0f)
            }, 0.012f);
        }

        private int SetLine(int index, string lineName, Color color, Vector3[] points, float width)
        {
            LineRenderer line = GetLine(index, lineName);
            line.positionCount = points.Length;
            line.startColor = color;
            line.endColor = color;
            line.widthMultiplier = width;

            for (int i = 0; i < points.Length; i++)
            {
                line.SetPosition(i, points[i]);
            }

            return index + 1;
        }

        private LineRenderer GetLine(int index, string lineName)
        {
            while (lines.Count <= index)
            {
                GameObject lineObject = new GameObject("DebugGuide");
                lineObject.transform.SetParent(transform, false);
                LineRenderer line = lineObject.AddComponent<LineRenderer>();
                line.useWorldSpace = false;
                line.numCapVertices = 0;
                line.numCornerVertices = 0;
                line.sortingOrder = 220;
                line.material = lineMaterial;
                lines.Add(line);
            }

            LineRenderer renderer = lines[index];
            renderer.gameObject.name = lineName;
            renderer.enabled = true;
            renderer.material = lineMaterial;
            return renderer;
        }

        private void SetLineCount(int count)
        {
            for (int i = count; i < lines.Count; i++)
            {
                if (lines[i] != null)
                {
                    lines[i].enabled = false;
                }
            }
        }

        private void SetLinesEnabled(bool enabled)
        {
            for (int i = 0; i < lines.Count; i++)
            {
                if (lines[i] != null)
                {
                    lines[i].enabled = enabled;
                }
            }
        }

        private void EnsureMaterial()
        {
            if (lineMaterial != null)
            {
                return;
            }

            Shader shader = PixelArtMaterialUtility.FindTransparentShader();

            if (shader == null)
            {
                shader = Shader.Find("Unlit/Color");
            }

            lineMaterial = new Material(shader)
            {
                name = "RoadDebugOverlayLineMaterial"
            };
            lineMaterial.hideFlags = HideFlags.DontSaveInEditor;
        }
    }
}
