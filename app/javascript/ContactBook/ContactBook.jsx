import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Layout from '../Layout/Layout.jsx'
import { ApolloProvider, Query } from 'react-apollo'
import ContactList from '../ContactList/ContactList.jsx'
import ContactDetails from '../ContactDetails/ContactDetails.jsx'
import NewContact from '../NewContact/NewContact.jsx'
import * as queries from '../graphql/queries.gql'
import graphQlClient from '../graphql/client.js'
import axios from 'axios'
import csrfToken from 'helpers/csrfToken.js'
import './ContactBook.scss'
import MiniSearch from 'minisearch'

const ContactBook = () => (
    <ApolloProvider client={graphQlClient}>
        <Query query={queries.contactBook}>
            {(props) => <ContactBookUI {...props} />}
        </Query>
    </ApolloProvider>
)

const ContactBookUI = ({ loading, error, data, refetch }) => {
    const { contacts } = data || {}
    const [filterContacts, setFilterContacts] = useState(null)
    const [selectedContact, setSelectedContact] = useState(null)
    const selectContact = (contact) => setSelectedContact(contact)
    const deselectContact = () => setSelectedContact(null)
    const [oldSearchValue, setOldSearchValue] = useState('')
    const [newSearchValue, setNewSearchValue] = useState('')
    const onSearchValueChange = e => {
        setOldSearchValue(newSearchValue);
        setNewSearchValue(e.target.value);
    }

    useEffect(() => {
        if (typeof data.contacts !== 'undefined' && oldSearchValue !== newSearchValue) {
            if (newSearchValue.length > 0) {
                setFilterContacts(getFilterDataFromSearch(data, newSearchValue));
            }
            else {
                setFilterContacts(data.contacts);
            }
        }
    }
    );

    return (
        <Layout>
            <div className='ContactBook'>
                {loading && <span className='loading'>Loading...</span>}
                {error && <span className='error'>{error.message || 'An unexpected error occurred'}</span>}
                <div className='ContactSearch'>
                    <label>Search: </label>
                    <input
                        value={newSearchValue}
                        onChange={onSearchValueChange}
                    />
                </div>
                {contacts && <ContactList contacts={filterContacts ? filterContacts : contacts} selectContact={selectContact} />}
                {selectedContact && <ContactDetails contact={selectedContact} deselectContact={deselectContact} />}
                <NewContact createContact={checkDuplicatesAndCreate} onSuccess={refetch} />
            </div>
        </Layout>
    )
}

ContactBookUI.propTypes = {
    loading: PropTypes.bool.isRequired,
    error: PropTypes.object,
    data: PropTypes.shape({
        data: PropTypes.array
    })
}

const createContact = ({ name, address, postalCode, city }) =>
    axios.post('/contacts', {
        contact: {
            name,
            address,
            postal_code: postalCode,
            city
        },
        authenticity_token: csrfToken()
    }, {
            headers: { 'Accept': 'application/json' },
            responseType: 'json'
        })

const findNearDuplicates = ({ name, address, postalCode, city }) =>
    axios.get('/contacts/near_duplicates', {
        params: {
            'contact[name]': name,
            'contact[address]': address,
            'contact[postal_code]': postalCode,
            'contact[city]': city
        },
        headers: { 'Accept': 'application/json' },
        responseType: 'json'
    })

const checkDuplicatesAndCreate = (newContact) =>
    findNearDuplicates(newContact).then(({ data: duplicates }) => {
        if (duplicates.length === 0 || confirmDuplicates(duplicates)) {
            return createContact(newContact)
        }

        return false
    })

const confirmDuplicates = (duplicates) => {
    const duplicatesPreview = duplicates.map(({ name, address, postal_code: postalCode, city }) =>
        `${name}, ${address}, ${postalCode}, ${city}`
    ).join('\n')

    return window.confirm(`The contact you are creating might be a duplicate of:
    \n${duplicatesPreview}
    \nDo you still want to create it?`)
}

const createMiniSearchFields = array => {
    if (array.contacts && array.contacts.length > 0) {
        let keysArray = Object.keys(array.contacts[0]);
        let keysAndTypeArray = [];

        keysArray.forEach(key => {
            keysAndTypeArray.push(key);
            keysAndTypeArray.push('text')
        });

        return keysAndTypeArray;
    }
    else {
        return [];
    }
}

const getFilterDataFromSearch = (data, searchValue) => {
    const miniSearch = new MiniSearch({
        fields: createMiniSearchFields(data),
        prefix: true,
        fuzzy: 0.2
    });

    miniSearch.addAll(data.contacts);
    const searchResult = miniSearch.search(searchValue);

    return data.contacts.filter(contact => searchResult.find(searchedContact => searchedContact.id === contact.id));
}

export default ContactBook
export { ContactBookUI, createContact, findNearDuplicates, getFilterDataFromSearch }
