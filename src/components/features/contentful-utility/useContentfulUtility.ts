import { GraphQLClient } from 'graphql-request';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import {
  ContentfulParams,
  editorialParameters,
  guestSpaceOptionalParameters,
  guestSpaceRequiredParameters,
  resetParam,
} from '@src/components/features/contentful-utility/constants';
import { getSdk } from '@src/lib/__generated/sdk';

interface ContentfulUtilityStore {
  xray: boolean;
  preview: boolean;
  domain?: 'contentful.com' | 'flinkly.com' | 'quirely.com';
  delivery_token?: string;
  preview_token?: string;
  space_id?: string;
}

const useContentfulUtilityStore = create<ContentfulUtilityStore>()(
  persist(
    (_set, _get) => ({
      preview: false,
      xray: false,
      domain: 'contentful.com',
    }),
    {
      name: 'contentful-utility-store',
      getStorage: () => sessionStorage,
    },
  ),
);

export const useContentfulUtility = () => {
  const { query } = useRouter();

  useEffect(() => {
    // If the reset parameter is passed, we reset the guest space store values and return early
    if (query[resetParam]) {
      [...guestSpaceRequiredParameters, ...guestSpaceOptionalParameters].forEach(key => {
        useContentfulUtilityStore.setState({ [key]: undefined });
      });

      return;
    }

    // Create a set of all the parameters that we care about
    const allParams = new Set([
      ...guestSpaceRequiredParameters,
      ...guestSpaceOptionalParameters,
      ...editorialParameters,
    ]);

    // Filter the query object to only include parameters that we care about
    const filteredQuery = Object.fromEntries(
      Object.entries(query).filter(([key]) => allParams.has(key as ContentfulParams)),
    );

    Object.entries(filteredQuery).forEach(([key, value]) => {
      switch (key) {
        case ContentfulParams.preview:
        case ContentfulParams.xray:
          if (value === 'true') useContentfulUtilityStore.setState({ [key]: true });
          if (value === 'false') useContentfulUtilityStore.setState({ [key]: false });

          return;
        default:
          /**
           * If a reset parameter is passed, we want to return early and not set any default parameters
           */
          if (query[resetParam]) {
            return;
          }

          /**
           * Check if all required guest space parameters are available, we only update the store if they are
           */
          if (guestSpaceRequiredParameters.some(key => !filteredQuery[key])) return;

          /**
           * If were dealing with an optional parameter, that wasn't passed, we delete the persisted value
           */
          if (guestSpaceOptionalParameters.includes(key as ContentfulParams) && !query[key]) {
            useContentfulUtilityStore.setState({ [key]: undefined });

            return;
          }

          useContentfulUtilityStore.setState({ [key]: value });
      }
    });
  }, [query]);

  const store = useContentfulUtilityStore();
  const { space_id, preview_token, delivery_token, domain, preview, xray } = store;

  /**
   * Check if we have all required parameters to make a guest space API client, or if we are not trying to reset the properties
   */
  if (guestSpaceRequiredParameters.some(key => !store[key]) || query[resetParam]) {
    return {
      preview,
      xray,
      client: null,
    };
  }

  const graphQlClient = new GraphQLClient(
    `https://graphql.${domain}/content/v1/spaces/${space_id}/`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${preview ? preview_token : delivery_token}`,
      },
    },
  );
  return {
    preview,
    xray,
    client: getSdk(graphQlClient),
  };
};
