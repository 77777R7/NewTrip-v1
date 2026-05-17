using System;
using UnityEngine;

namespace NewTrip.Client.Road
{
    [Serializable]
    public sealed class RoadProjectionSettings
    {
        [Range(0f, 1.2f)]
        public float horizonY = 0.56f;

        [Range(0f, 1.2f)]
        public float bottomY = 0.02f;

        [Range(0.01f, 1f)]
        public float nearHalfWidth = 0.64f;

        [Range(0.001f, 0.2f)]
        public float horizonHalfWidth = 0.025f;

        [Range(0.5f, 4f)]
        public float depthCurve = 1.65f;

        [Range(0f, 1f)]
        public float centerX = 0.5f;

        public RoadProjectionSample Sample(float depth01, float renderWidth, float renderHeight)
        {
            float clampedDepth = Mathf.Clamp01(depth01);
            float perspectiveT = Mathf.Pow(clampedDepth, depthCurve);
            float viewportY = Mathf.Lerp(bottomY, horizonY, perspectiveT);
            float halfWidthViewport = Mathf.Lerp(nearHalfWidth, horizonHalfWidth, perspectiveT);
            float y = ViewportYToLocal(viewportY, renderHeight);
            float center = ViewportXToLocal(centerX, renderWidth);
            float halfWidth = halfWidthViewport * renderWidth;

            return new RoadProjectionSample(
                depth01: clampedDepth,
                viewportY: viewportY,
                centerX: center,
                y: y,
                halfWidth: halfWidth
            );
        }

        public float ViewportXToLocal(float viewportX, float renderWidth)
        {
            return (viewportX - 0.5f) * renderWidth;
        }

        public float ViewportYToLocal(float viewportY, float renderHeight)
        {
            return (viewportY - 0.5f) * renderHeight;
        }
    }

    public readonly struct RoadProjectionSample
    {
        public RoadProjectionSample(float depth01, float viewportY, float centerX, float y, float halfWidth)
        {
            Depth01 = depth01;
            ViewportY = viewportY;
            CenterX = centerX;
            Y = y;
            HalfWidth = halfWidth;
        }

        public float Depth01 { get; }

        public float ViewportY { get; }

        public float CenterX { get; }

        public float Y { get; }

        public float HalfWidth { get; }

        public Vector3 PointAt(float lateralRoadOffset, float z = 0f)
        {
            return new Vector3(CenterX + HalfWidth * lateralRoadOffset, Y, z);
        }
    }
}
