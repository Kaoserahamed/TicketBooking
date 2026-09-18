# 9. Search Architecture

## 9.1 Problem Statement

Do not perform complex event searches directly against the primary database at high traffic.

```text
PostgreSQL/MySQL
       │
       │ Event changes
       ▼
Message Queue
       │
       ▼
Search Index
       │
       ▼
OpenSearch / Elasticsearch
```

## 9.2 Search Fields

Index the following fields for search:

```text
Event name
Category
Location
Date
Venue
Price
Language
Tags
```

## 9.3 Consistency

Search can use **eventual consistency** because a newly created event does not need millisecond-level consistency. Events are pushed to a message queue, which updates the search index asynchronously.

## 9.4 Implementation

- Use a message queue (e.g., RabbitMQ or Kafka) to stream database changes.
- A search worker consumes messages and updates the OpenSearch/Elasticsearch index.
- Search queries are served from the search engine, reducing load on the primary MySQL database.
