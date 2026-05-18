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
        public bool animateInEditMode;

        [SerializeField]
        private float visualDistanceMeters;

        private float previousSpeedMetersPerSecond;

        public float VisualDistanceMeters => visualDistanceMeters;

        public float VisualSpeedMetersPerSecond => Mathf.Max(0f, serverSpeedKmph) * 1000f / 3600f * Mathf.Max(0f, visualSpeedMultiplier);

        public float VisualSpeedNorm => Mathf.Clamp(baselineSpeedKmph <= 0f ? 0f : serverSpeedKmph / baselineSpeedKmph, 0f, 1.35f);

        public float AccelerationNorm { get; private set; }

        private void OnEnable()
        {
            previousSpeedMetersPerSecond = VisualSpeedMetersPerSecond;
        }

        private void Update()
        {
            if (!Application.isPlaying && !animateInEditMode)
            {
                return;
            }

            Tick(Time.deltaTime);
        }

        public void SetServerSpeedKmph(float speedKmph)
        {
            serverSpeedKmph = Mathf.Max(0f, speedKmph);
        }

        public void ResetDistance(float distanceMeters = 0f)
        {
            visualDistanceMeters = Mathf.Max(0f, distanceMeters);
            previousSpeedMetersPerSecond = VisualSpeedMetersPerSecond;
            AccelerationNorm = 0f;
        }

        public void SetVisualDistanceForReview(float distanceMeters)
        {
            visualDistanceMeters = Mathf.Max(0f, distanceMeters);
        }

        public void Tick(float deltaTime)
        {
            float clampedDelta = Mathf.Max(0f, deltaTime);
            float speedMetersPerSecond = VisualSpeedMetersPerSecond;
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
