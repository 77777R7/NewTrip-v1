using System;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class RoadSceneController : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public LaneMarkingRenderer laneMarkingRenderer;
        public CarRearController carRearController;
        public SideObjectSpawner sideObjectSpawner;
        public LandmarkSignSpawner landmarkSignSpawner;
        public WeatherOverlayRenderer weatherOverlayRenderer;

        [Header("Demo Preview Only")]
        public bool runDemoPreview = true;
        public float serverSpeedKmph = 72f;
        public float demoDistancePreviewKm;
        public string initialWeatherKey = "haze";
        public float demoSignSpawnIntervalSeconds = 5.5f;

        private readonly string[] demoWeatherCycle = { "clear", "haze", "fog", "rain" };
        private int weatherIndex;
        private float demoSignTimer;
        private bool spawnNextSignOnLeft;
        private bool legacyInputUnavailable;

        private void Start()
        {
            ApplyServerVisualState(demoDistancePreviewKm, serverSpeedKmph, initialWeatherKey, false, "LANDMARK_REQUIRED");
            demoSignTimer = demoSignSpawnIntervalSeconds;
        }

        private void Update()
        {
            if (runDemoPreview)
            {
                demoDistancePreviewKm += serverSpeedKmph * Time.deltaTime / 3600f;
            }

            if (GetKey(KeyCode.UpArrow))
            {
                serverSpeedKmph = Mathf.Min(97.2f, serverSpeedKmph + 18f * Time.deltaTime);
            }

            if (GetKey(KeyCode.DownArrow))
            {
                serverSpeedKmph = Mathf.Max(0f, serverSpeedKmph - 24f * Time.deltaTime);
            }

            bool boosting = GetKey(KeyCode.Space);
            float visualSpeedKmph = boosting ? serverSpeedKmph * 1.1f : serverSpeedKmph;
            ApplySpeed(visualSpeedKmph);

            if (carRearController != null)
            {
                carRearController.SetBoosting(boosting);
            }

            if (GetKeyDown(KeyCode.S) && landmarkSignSpawner != null)
            {
                landmarkSignSpawner.SpawnPlaceholderSign(RoadsideSide.Right);
            }

            if (runDemoPreview && landmarkSignSpawner != null)
            {
                demoSignTimer -= Time.deltaTime;

                if (demoSignTimer <= 0f)
                {
                    landmarkSignSpawner.SpawnPlaceholderSign(spawnNextSignOnLeft ? RoadsideSide.Left : RoadsideSide.Right);
                    spawnNextSignOnLeft = !spawnNextSignOnLeft;
                    demoSignTimer = demoSignSpawnIntervalSeconds;
                }
            }

            if (GetKeyDown(KeyCode.W) && weatherOverlayRenderer != null)
            {
                weatherIndex = (weatherIndex + 1) % demoWeatherCycle.Length;
                weatherOverlayRenderer.SetWeather(demoWeatherCycle[weatherIndex]);
            }
        }

        public void ApplyServerVisualState(float currentDistanceKm, float speedKmph, string weatherKey, bool boosting, string forcedStopReason)
        {
            demoDistancePreviewKm = currentDistanceKm;
            serverSpeedKmph = Mathf.Max(0f, speedKmph);
            ApplySpeed(boosting ? serverSpeedKmph * 1.1f : serverSpeedKmph);

            if (carRearController != null)
            {
                carRearController.SetBoosting(boosting);
            }

            if (weatherOverlayRenderer != null)
            {
                weatherOverlayRenderer.SetWeather(weatherKey);
            }

            if (!string.IsNullOrEmpty(forcedStopReason) && landmarkSignSpawner != null)
            {
                landmarkSignSpawner.SpawnPlaceholderSign(RoadsideSide.Right);
            }
        }

        private void ApplySpeed(float speedKmph)
        {
            if (roadRenderer != null)
            {
                roadRenderer.SetServerSpeed(speedKmph);
            }
        }

        private bool GetKey(KeyCode keyCode)
        {
            if (legacyInputUnavailable)
            {
                return false;
            }

            try
            {
                return Input.GetKey(keyCode);
            }
            catch (InvalidOperationException)
            {
                legacyInputUnavailable = true;
                return false;
            }
        }

        private bool GetKeyDown(KeyCode keyCode)
        {
            if (legacyInputUnavailable)
            {
                return false;
            }

            try
            {
                return Input.GetKeyDown(keyCode);
            }
            catch (InvalidOperationException)
            {
                legacyInputUnavailable = true;
                return false;
            }
        }
    }
}
