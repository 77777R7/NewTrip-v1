using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    public sealed class RoadMotionState : MonoBehaviour
    {
        public const float DefaultBaselineSpeedKmph = 72f;

        public float serverSpeedKmph = DefaultBaselineSpeedKmph;
        public float visualSpeedMultiplier = 1f;
        public float baselineSpeedKmph = DefaultBaselineSpeedKmph;
        [Tooltip("Seconds for visual speed to ease toward server speed. This keeps road, lane, edge, car bob, and wheel cues in one smoothed motion world.")]
        public float speedSmoothingSeconds = 1.45f;
        public bool animateInEditMode;

        [SerializeField]
        private float visualDistanceMeters;

        [SerializeField]
        private float currentVisualSpeedMetersPerSecond = -1f;

        private float previousSpeedMetersPerSecond;

        public float VisualDistanceMeters => visualDistanceMeters;

        public float TargetVisualSpeedMetersPerSecond => Mathf.Max(0f, serverSpeedKmph) * 1000f / 3600f * Mathf.Max(0f, visualSpeedMultiplier);

        public float VisualSpeedMetersPerSecond => currentVisualSpeedMetersPerSecond < 0f
            ? TargetVisualSpeedMetersPerSecond
            : Mathf.Max(0f, currentVisualSpeedMetersPerSecond);

        public float TargetVisualSpeedNorm => Mathf.Clamp(baselineSpeedKmph <= 0f ? 0f : serverSpeedKmph / baselineSpeedKmph, 0f, 1.35f);

        public float VisualSpeedNorm => Mathf.Clamp(
            baselineSpeedKmph <= 0f ? 0f : VisualSpeedMetersPerSecond / (baselineSpeedKmph * 1000f / 3600f),
            0f,
            1.35f
        );

        public float AccelerationNorm { get; private set; }

        private void OnEnable()
        {
            SnapVisualSpeedToTarget();
        }

        private void OnValidate()
        {
            serverSpeedKmph = Mathf.Max(0f, serverSpeedKmph);
            visualSpeedMultiplier = Mathf.Max(0f, visualSpeedMultiplier);
            baselineSpeedKmph = Mathf.Max(0.01f, baselineSpeedKmph);
            speedSmoothingSeconds = Mathf.Max(0f, speedSmoothingSeconds);
            currentVisualSpeedMetersPerSecond = Mathf.Max(-1f, currentVisualSpeedMetersPerSecond);
        }

        private void Update()
        {
            if (!Application.isPlaying && !animateInEditMode)
            {
                return;
            }

            Tick(Time.deltaTime);
        }

        public void SetServerSpeedKmph(float speedKmph, bool snapVisualSpeed = false)
        {
            serverSpeedKmph = Mathf.Max(0f, speedKmph);

            if (snapVisualSpeed || currentVisualSpeedMetersPerSecond < 0f)
            {
                SnapVisualSpeedToTarget();
            }
        }

        public void ResetDistance(float distanceMeters = 0f)
        {
            visualDistanceMeters = Mathf.Max(0f, distanceMeters);
            SnapVisualSpeedToTarget();
            AccelerationNorm = 0f;
        }

        public void SetVisualDistanceForReview(float distanceMeters)
        {
            visualDistanceMeters = Mathf.Max(0f, distanceMeters);
        }

        public void SetReviewSpeedKmph(float speedKmph)
        {
            SetServerSpeedKmph(speedKmph, snapVisualSpeed: true);
        }

        public void SnapVisualSpeedToTarget()
        {
            currentVisualSpeedMetersPerSecond = TargetVisualSpeedMetersPerSecond;
            previousSpeedMetersPerSecond = currentVisualSpeedMetersPerSecond;
        }

        public void Tick(float deltaTime)
        {
            float clampedDelta = Mathf.Max(0f, deltaTime);
            float targetSpeedMetersPerSecond = TargetVisualSpeedMetersPerSecond;
            float response = speedSmoothingSeconds <= 0.001f
                ? 1f
                : 1f - Mathf.Exp(-clampedDelta / speedSmoothingSeconds);
            float speedMetersPerSecond = Mathf.Lerp(VisualSpeedMetersPerSecond, targetSpeedMetersPerSecond, response);
            currentVisualSpeedMetersPerSecond = speedMetersPerSecond;
            visualDistanceMeters += speedMetersPerSecond * clampedDelta;
            AccelerationNorm = baselineSpeedKmph <= 0f
                ? 0f
                : (speedMetersPerSecond - previousSpeedMetersPerSecond) / (baselineSpeedKmph * 1000f / 3600f);
            previousSpeedMetersPerSecond = speedMetersPerSecond;
        }

        public float TextureOffset(float metersPerRepeat)
        {
            return Mathf.Repeat(visualDistanceMeters / Mathf.Max(0.01f, metersPerRepeat), 1f);
        }
    }
}
