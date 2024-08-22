/*
 * Copyright 2024 Harness, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react'
import type { Cell, CellValue, ColumnInstance, Renderer, Row, TableInstance } from 'react-table'
import type { DockerManifestDetails } from '@harnessio/react-har-service-client'

import { useDecodedParams, useRoutes } from '@ar/hooks'
import type { ArtifactDetailsPathParams } from '@ar/routes/types'
import TableCells from '@ar/components/TableCells/TableCells'
import { getShortDigest } from '@ar/pages/digest-list/utils'
import { VersionDetailsTab } from '@ar/pages/version-details/components/VersionDetailsTabs/constants'

type CellTypeWithActions<D extends Record<string, any>, V = any> = TableInstance<D> & {
  column: ColumnInstance<D>
  row: Row<D>
  cell: Cell<D, V>
  value: CellValue<V>
}

type CellType = Renderer<CellTypeWithActions<DockerManifestDetails>>

type DigestNameColumnProps = {
  version: string
}

export const DigestNameCell: Renderer<{
  row: Row<DockerManifestDetails>
  column: ColumnInstance<DockerManifestDetails> & DigestNameColumnProps
}> = ({ row, column }) => {
  const { original } = row
  const { version } = column
  const value = original.digest
  const pathParams = useDecodedParams<ArtifactDetailsPathParams>()
  const routes = useRoutes()

  const linkTo = routes.toARVersionDetailsTab({
    repositoryIdentifier: pathParams.repositoryIdentifier,
    artifactIdentifier: pathParams.artifactIdentifier,
    versionIdentifier: version,
    versionTab: VersionDetailsTab.OVERVIEW
  })
  return <TableCells.LinkCell label={getShortDigest(value)} linkTo={`${linkTo}?digest=${value}`} />
}

export const OsArchCell: CellType = ({ value }) => {
  return <TableCells.TextCell value={value} />
}

export const SizeCell: CellType = ({ value }) => {
  return <TableCells.SizeCell value={value} />
}

export const UploadedByCell: CellType = ({ value }) => {
  return <TableCells.LastModifiedCell value={value} />
}

export const DownloadsCell: CellType = ({ value }) => {
  return <TableCells.CountCell value={value} icon="download-box" iconProps={{ size: 12 }} />
}

export const DigestActionsCell: CellType = () => {
  return <></>
}
