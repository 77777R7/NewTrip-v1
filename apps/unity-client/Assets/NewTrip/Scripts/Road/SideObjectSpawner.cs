using System.Collections.Generic;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class SideObjectSpawner : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public RoadMotionState motionState;
        public Transform objectRoot;
        public RoadsideSpawnProfile profile;
        public int randomSeed = 1729;
        public bool spawnInPlayModeOnly = true;
        public bool useDistanceBasedMotion = true;
        public bool seedInitialDistanceWindow = true;
        public int initialPreviewObjectCount = 12;
        public int maxActiveObjects = 40;

        [Range(0.2f, 1f)]
        public float spawnDepth = 0.86f;

        [Range(-0.3f, 0.2f)]
        public float despawnDepth = -0.08f;

        private readonly List<SpawnedSideObject> activeObjects = new List<SpawnedSideObject>();
        private System.Random random;
        private float spawnTimer;
        private float fallbackDistanceMeters;
        private float nextSpawnDistanceMeters;
        private bool distanceScheduleInitialized;

        private void Awake()
        {
            EnsureRandom();
            ScheduleNextSpawn();
        }

        private void Update()
        {
            if (spawnInPlayModeOnly && !Application.isPlaying)
            {
                return;
            }

            EnsureRandom();

            if (roadRenderer == null || profile == null)
            {
                return;
            }

            if (useDistanceBasedMotion)
            {
                UpdateDistanceBasedMotion();
                return;
            }

            float moveRate = profile.depthMoveRate * Mathf.Max(0.12f, roadRenderer.VisualSpeed);

            for (int i = activeObjects.Count - 1; i >= 0; i--)
            {
                SpawnedSideObject sideObject = activeObjects[i];
                sideObject.Depth -= Time.deltaTime * moveRate * Mathf.Max(0.1f, sideObject.Entry.parallaxSpeed);

                if (sideObject.Depth < -0.08f)
                {
                    DestroyObject(sideObject.Root.gameObject);
                    activeObjects.RemoveAt(i);
                    continue;
                }

                ApplyProjection(sideObject, 0f);
            }

            spawnTimer -= Time.deltaTime;

            if (spawnTimer <= 0f)
            {
                SpawnOne();
                ScheduleNextSpawn();
            }
        }

        public void Clear()
        {
            for (int i = activeObjects.Count - 1; i >= 0; i--)
            {
                if (activeObjects[i].Root != null)
                {
                    DestroyObject(activeObjects[i].Root.gameObject);
                }
            }

            activeObjects.Clear();
            distanceScheduleInitialized = false;
        }

        public void RebuildDistancePreview(float currentDistanceMeters)
        {
            Clear();
            random = new System.Random(randomSeed);

            if (roadRenderer == null || profile == null)
            {
                return;
            }

            int count = Mathf.Clamp(initialPreviewObjectCount, 1, maxActiveObjects);
            float travelMeters = DepthTravelMeters();

            for (int i = 0; i < count; i++)
            {
                float progress = (i + 0.5f) / count;
                SpawnOneAtDistance(currentDistanceMeters - progress * travelMeters);
            }

            nextSpawnDistanceMeters = currentDistanceMeters + NextSpacingMeters();
            distanceScheduleInitialized = true;
            ApplyAllProjections(currentDistanceMeters);
        }

        private void UpdateDistanceBasedMotion()
        {
            float currentDistance = CurrentDistanceMeters();

            if (!distanceScheduleInitialized)
            {
                InitializeDistanceSchedule(currentDistance);
            }

            for (int i = activeObjects.Count - 1; i >= 0; i--)
            {
                SpawnedSideObject sideObject = activeObjects[i];
                sideObject.Depth = DepthFromDistance(sideObject, currentDistance);

                if (sideObject.Depth < despawnDepth)
                {
                    DestroyObject(sideObject.Root.gameObject);
                    activeObjects.RemoveAt(i);
                    continue;
                }

                ApplyProjection(sideObject, currentDistance);
            }

            int safety = 0;

            while (currentDistance >= nextSpawnDistanceMeters && safety < 8)
            {
                SpawnOneAtDistance(nextSpawnDistanceMeters);
                nextSpawnDistanceMeters += NextSpacingMeters();
                safety++;
            }
        }

        private void InitializeDistanceSchedule(float currentDistance)
        {
            distanceScheduleInitialized = true;

            if (seedInitialDistanceWindow)
            {
                RebuildDistancePreview(currentDistance);
                return;
            }

            nextSpawnDistanceMeters = currentDistance + NextSpacingMeters();
        }

        private void SpawnOne()
        {
            SpawnOneAtDistance(CurrentDistanceMeters());
        }

        private void SpawnOneAtDistance(float spawnDistanceMeters)
        {
            EnsureRandom();

            RoadsideSpawnEntry entry = profile.Pick(random);

            if (entry == null || entry.sprite == null)
            {
                return;
            }

            Transform parent = objectRoot != null ? objectRoot : transform;
            GameObject root = new GameObject("SideObject_" + entry.spriteId);
            root.transform.SetParent(parent, false);

            SpriteRenderer spriteRenderer = root.AddComponent<SpriteRenderer>();
            spriteRenderer.sprite = entry.sprite;
            spriteRenderer.color = entry.tint;
            spriteRenderer.sortingOrder = 40;
            spriteRenderer.sharedMaterial = PixelArtMaterialUtility.GetSharedTransparentSpriteMaterial();

            SpawnedSideObject sideObject = new SpawnedSideObject(root.transform, spriteRenderer, entry)
            {
                Depth = spawnDepth,
                SpawnDistanceMeters = spawnDistanceMeters
            };

            activeObjects.Add(sideObject);

            if (activeObjects.Count > maxActiveObjects)
            {
                DestroyObject(activeObjects[0].Root.gameObject);
                activeObjects.RemoveAt(0);
            }

            ApplyProjection(sideObject, CurrentDistanceMeters());
        }

        private void ApplyProjection(SpawnedSideObject sideObject, float currentDistanceMeters)
        {
            if (useDistanceBasedMotion)
            {
                sideObject.Depth = DepthFromDistance(sideObject, currentDistanceMeters);
            }

            float sideSign = sideObject.Entry.side == RoadsideSide.Left ? -1f : 1f;
            RoadProjectionSample sample = roadRenderer.Sample(sideObject.Depth);
            float outsideOffset = 1f + Mathf.Max(0f, sideObject.Entry.laneOffset);
            float x = sample.CenterX + sample.HalfWidth * outsideOffset * sideSign;
            float scale = Mathf.Lerp(sideObject.Entry.nearScale, sideObject.Entry.farScale, Mathf.Clamp01(sideObject.Depth));

            sideObject.Root.localPosition = new Vector3(x, sample.Y, -0.04f);
            sideObject.Root.localScale = Vector3.one * scale;
            sideObject.Renderer.sortingOrder = sideObject.Depth < 0.35f ? 65 : 35;
        }

        private void ApplyAllProjections(float currentDistanceMeters)
        {
            for (int i = activeObjects.Count - 1; i >= 0; i--)
            {
                ApplyProjection(activeObjects[i], currentDistanceMeters);
            }
        }

        private float CurrentDistanceMeters()
        {
            if (motionState != null)
            {
                return motionState.VisualDistanceMeters;
            }

            fallbackDistanceMeters += roadRenderer != null
                ? roadRenderer.VisualSpeed * Mathf.Max(0f, Time.deltaTime) * 20f
                : 0f;
            return fallbackDistanceMeters;
        }

        private float DepthFromDistance(SpawnedSideObject sideObject, float currentDistanceMeters)
        {
            float travelled = Mathf.Max(0f, currentDistanceMeters - sideObject.SpawnDistanceMeters);
            travelled *= Mathf.Max(0.1f, sideObject.Entry.parallaxSpeed);
            float progress = travelled / DepthTravelMeters();
            return Mathf.Lerp(spawnDepth, despawnDepth, progress);
        }

        private float DepthTravelMeters()
        {
            return profile != null ? Mathf.Max(1f, profile.depthTravelMeters) : 58f;
        }

        private float NextSpacingMeters()
        {
            if (profile == null)
            {
                return 16f;
            }

            float min = Mathf.Min(profile.spawnSpacingMeters.x, profile.spawnSpacingMeters.y);
            float max = Mathf.Max(profile.spawnSpacingMeters.x, profile.spawnSpacingMeters.y);
            return Mathf.Lerp(min, max, (float)random.NextDouble());
        }

        private void ScheduleNextSpawn()
        {
            EnsureRandom();

            if (profile == null)
            {
                spawnTimer = 0.5f;
                return;
            }

            float min = Mathf.Min(profile.spawnIntervalSeconds.x, profile.spawnIntervalSeconds.y);
            float max = Mathf.Max(profile.spawnIntervalSeconds.x, profile.spawnIntervalSeconds.y);
            spawnTimer = Mathf.Lerp(min, max, (float)random.NextDouble());
        }

        private void EnsureRandom()
        {
            if (random == null)
            {
                random = new System.Random(randomSeed);
            }
        }

        private static void DestroyObject(GameObject gameObject)
        {
            if (Application.isPlaying)
            {
                Destroy(gameObject);
            }
            else
            {
                DestroyImmediate(gameObject);
            }
        }

        private sealed class SpawnedSideObject
        {
            public SpawnedSideObject(Transform root, SpriteRenderer renderer, RoadsideSpawnEntry entry)
            {
                Root = root;
                Renderer = renderer;
                Entry = entry;
            }

            public Transform Root { get; }

            public SpriteRenderer Renderer { get; }

            public RoadsideSpawnEntry Entry { get; }

            public float Depth { get; set; }

            public float SpawnDistanceMeters { get; set; }
        }
    }
}
