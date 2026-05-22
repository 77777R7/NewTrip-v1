using System;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public static class RoadViewportContract
    {
        public const float WorldWidth = 5.625f;
        public const float WorldHeight = 10f;
        public const float CenterX = 0.5f;
        public const float RoadHorizonY = 0.66f;
        public const float RoadBottomY = -0.08f;
        public const float RoadNearHalfWidth = 0.94f;
        public const float RoadHorizonHalfWidth = 0.038f;
        public const float RoadDepthCurve = 2.45f;
        public const float CarAnchorX = 0.5f;
        public const float CarAnchorY = 0.105f;
        public const float HudSafeTopY = 0.86f;
    }

    public enum RoadProjectionPreset
    {
        ContractDefault,
        BigSurPrototype,
        WideDebug,
        GeminiLowCamera
    }

    [Serializable]
    public sealed class RoadProjectionSettings
    {
        [Range(0f, 1.2f)]
        public float horizonY = RoadViewportContract.RoadHorizonY;

        [Range(0f, 1.2f)]
        public float bottomY = RoadViewportContract.RoadBottomY;

        [Range(0.01f, 1f)]
        public float nearHalfWidth = RoadViewportContract.RoadNearHalfWidth;

        [Range(0.001f, 0.2f)]
        public float horizonHalfWidth = RoadViewportContract.RoadHorizonHalfWidth;

        [Range(0.5f, 4f)]
        public float depthCurve = RoadViewportContract.RoadDepthCurve;

        [Range(0f, 1f)]
        public float centerX = RoadViewportContract.CenterX;

        public void ApplyPreset(RoadProjectionPreset preset)
        {
            switch (preset)
            {
                case RoadProjectionPreset.BigSurPrototype:
                    centerX = 0.5f;
                    horizonY = 0.52f;
                    bottomY = -0.04f;
                    nearHalfWidth = 0.84f;
                    horizonHalfWidth = 0.028f;
                    depthCurve = 1.85f;
                    break;

                case RoadProjectionPreset.WideDebug:
                    centerX = 0.5f;
                    horizonY = 0.54f;
                    bottomY = -0.05f;
                    nearHalfWidth = 0.86f;
                    horizonHalfWidth = 0.035f;
                    depthCurve = 1.85f;
                    break;

                case RoadProjectionPreset.GeminiLowCamera:
                    // Current OutRun-style production prototype angle based on the Gemini note:
                    // raise the vanishing point toward the upper third and use a stronger
                    // exponential depth curve so far slices compress and near slices stretch.
                    ApplyContractDefault();
                    break;

                default:
                    ApplyContractDefault();
                    break;
            }
        }

        private void ApplyContractDefault()
        {
            centerX = RoadViewportContract.CenterX;
            horizonY = RoadViewportContract.RoadHorizonY;
            bottomY = RoadViewportContract.RoadBottomY;
            nearHalfWidth = RoadViewportContract.RoadNearHalfWidth;
            horizonHalfWidth = RoadViewportContract.RoadHorizonHalfWidth;
            depthCurve = RoadViewportContract.RoadDepthCurve;
        }

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
