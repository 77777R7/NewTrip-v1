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
                totalWeight += Mathf.Max(0f, entries[i].rarityWeight);
            }

            if (totalWeight <= 0f)
            {
                return entries[0];
            }

            double roll = random.NextDouble() * totalWeight;
            float cursor = 0f;

            for (int i = 0; i < entries.Count; i++)
            {
                cursor += Mathf.Max(0f, entries[i].rarityWeight);

                if (roll <= cursor)
                {
                    return entries[i];
                }
            }

            return entries[entries.Count - 1];
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
