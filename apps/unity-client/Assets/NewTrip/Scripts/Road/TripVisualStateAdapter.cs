using System;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class TripVisualStateAdapter : MonoBehaviour
    {
        public RoadSceneController sceneController;

        public void ApplyTripState(TripVisualStateDto state)
        {
            if (sceneController == null || state == null)
            {
                return;
            }

            sceneController.ApplyServerVisualState(
                state.currentDistanceKm,
                state.speedKmph,
                state.weatherKey,
                state.driveMode == "HOLD_TO_BOOST",
                state.forcedStopReason
            );
        }
    }

    [Serializable]
    public sealed class TripVisualStateDto
    {
        public string routeKey = "tutorial_big_sur_hwy1_001";
        public float currentDistanceKm;
        public float speedKmph = 72f;
        public string driveMode = "AUTO_DRIVING";
        public string weatherKey = "clear";
        public string forcedStopReason;
        public string visualPackKey = "bigsur_sunset";
    }
}
