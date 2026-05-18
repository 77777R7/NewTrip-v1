using System;
using System.Collections.Generic;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public enum RoadsideSide
    {
        Left,
        Right
    }

    [CreateAssetMenu(menuName = "NewTrip/Road/Roadside Spawn Profile")]
    public sealed class RoadsideSpawnProfile : ScriptableObject
    {
        public Vector2 spawnIntervalSeconds = new Vector2(0.32f, 0.78f);
        public Vector2 spawnSpacingMeters = new Vector2(10f, 24f);
        public float depthTravelMeters = 58f;
        public float depthMoveRate = 0.32f;
        public List<RoadsideSpawnEntry> entries = new List<RoadsideSpawnEntry>();

        public RoadsideSpawnEntry Pick(System.Random random)
        {
            if (entries == null || entries.Count == 0)
            {
                return null;
            }

            float totalWeight = 0f;

            for (int i = 0; i < entries.Count; i++)
            {
                RoadsideSpawnEntry entry = entries[i];

                if (entry == null)
                {
                    continue;
                }

                totalWeight += Mathf.Max(0f, entry.rarityWeight);
            }

            if (totalWeight <= 0f)
            {
                return FirstValidEntry();
            }

            double roll = (random ?? new System.Random()).NextDouble() * totalWeight;
            float cursor = 0f;

            for (int i = 0; i < entries.Count; i++)
            {
                RoadsideSpawnEntry entry = entries[i];

                if (entry == null)
                {
                    continue;
                }

                cursor += Mathf.Max(0f, entry.rarityWeight);

                if (roll <= cursor)
                {
                    return entry;
                }
            }

            return LastValidEntry();
        }

        private RoadsideSpawnEntry FirstValidEntry()
        {
            for (int i = 0; i < entries.Count; i++)
            {
                if (entries[i] != null)
                {
                    return entries[i];
                }
            }

            return null;
        }

        private RoadsideSpawnEntry LastValidEntry()
        {
            for (int i = entries.Count - 1; i >= 0; i--)
            {
                if (entries[i] != null)
                {
                    return entries[i];
                }
            }

            return null;
        }
    }

    [Serializable]
    public sealed class RoadsideSpawnEntry
    {
        public string spriteId = "roadside_placeholder";
        public Sprite sprite;
        public Color tint = Color.white;
        public RoadsideSide side = RoadsideSide.Right;
        public float laneOffset = 0.38f;
        public float nearScale = 1.25f;
        public float farScale = 0.12f;
        public float parallaxSpeed = 1f;
        public float rarityWeight = 1f;
    }
}
