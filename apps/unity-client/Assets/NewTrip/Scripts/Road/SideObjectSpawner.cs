using System.Collections.Generic;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class SideObjectSpawner : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public Transform objectRoot;
        public RoadsideSpawnProfile profile;
        public int randomSeed = 1729;
        public bool spawnInPlayModeOnly = true;

        private readonly List<SpawnedSideObject> activeObjects = new List<SpawnedSideObject>();
        private System.Random random;
        private float spawnTimer;

        private void Awake()
        {
            random = new System.Random(randomSeed);
            ScheduleNextSpawn();
        }

        private void Update()
        {
            if (spawnInPlayModeOnly && !Application.isPlaying)
            {
                return;
            }

            if (roadRenderer == null || profile == null)
            {
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

                ApplyProjection(sideObject);
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
        }

        private void SpawnOne()
        {
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

            SpawnedSideObject sideObject = new SpawnedSideObject(root.transform, spriteRenderer, entry)
            {
                Depth = 1f
            };

            activeObjects.Add(sideObject);
            ApplyProjection(sideObject);
        }

        private void ApplyProjection(SpawnedSideObject sideObject)
        {
            float sideSign = sideObject.Entry.side == RoadsideSide.Left ? -1f : 1f;
            RoadProjectionSample sample = roadRenderer.Sample(sideObject.Depth);
            float outsideOffset = 1f + Mathf.Max(0f, sideObject.Entry.laneOffset);
            float x = sample.CenterX + sample.HalfWidth * outsideOffset * sideSign;
            float scale = Mathf.Lerp(sideObject.Entry.nearScale, sideObject.Entry.farScale, Mathf.Clamp01(sideObject.Depth));

            sideObject.Root.localPosition = new Vector3(x, sample.Y, -0.04f);
            sideObject.Root.localScale = Vector3.one * scale;
            sideObject.Renderer.sortingOrder = sideObject.Depth < 0.35f ? 65 : 35;
        }

        private void ScheduleNextSpawn()
        {
            if (profile == null)
            {
                spawnTimer = 0.5f;
                return;
            }

            float min = Mathf.Min(profile.spawnIntervalSeconds.x, profile.spawnIntervalSeconds.y);
            float max = Mathf.Max(profile.spawnIntervalSeconds.x, profile.spawnIntervalSeconds.y);
            spawnTimer = Mathf.Lerp(min, max, (float)random.NextDouble());
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
        }
    }
}
